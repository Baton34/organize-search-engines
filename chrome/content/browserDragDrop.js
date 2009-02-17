/* -*- js-standard: mozdomwindow,chromewindow,mozscript;
       js-import:browser.js; js-var:;                     -*- */
/* ***** BEGIN LICENSE BLOCK *****
Version: MPL 1.1/GPL 2.0/LGPL 2.1

The contents of this file are subject to the Mozilla Public License Version
1.1 (the "License"); you may not use this file except in compliance with
the License. You may obtain a copy of the License at
http://www.mozilla.org/MPL/

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
for the specific language governing rights and limitations under the
License.

The Original Code is Organize Search Engines.

The Initial Developer of the Original Code is
Malte Kraus.
Portions created by the Initial Developer are Copyright (C) 2006-2009
the Initial Developer. All Rights Reserved.

Contributor(s):
  Malte Kraus <mails@maltekraus.de> (Original author)

 Alternatively, the contents of this file may be used under the terms of
 either the GNU General Public License Version 2 or later (the "GPL"), or
 the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 in which case the provisions of the GPL or the LGPL are applicable instead
 of those above. If you wish to allow use of your version of this file only
 under the terms of either the GPL or the LGPL, and not to allow others to
 use your version of this file under the terms of the MPL, indicate your
 decision by deleting the provisions above and replace them with the notice
 and other provisions required by the GPL or the LGPL. If you do not delete
 the provisions above, a recipient may use your version of this file under
 the terms of any one of the MPL, the GPL or the LGPL.
***** END LICENSE BLOCK ***** */

var seOrganizer_dragObserver = {
  init: function() {
    organizeSE._customizeToolbarListeners.push(this.onCustomizeToolbarFinished);
  },

  onCustomizeToolbarFinished: function() {
    var button = this.searchbar.searchButton;
    button.setAttribute("ondragenter", "seOrganizer_dragObserver.onDragEnter(event);");
    button.setAttribute("ondragover", "nsDragAndDrop.dragOver(event, seOrganizer_dragObserver);");
    button.setAttribute("ondragexit", "nsDragAndDrop.dragExit(event, seOrganizer_dragObserver);");
  },

  springLoadedMenuDelay: 350,
  hoveredItems: [],

  onDragEnter: function(event) {
    if(this.overButton(event.target)) {
      organizeSE.searchbar._textbox.openSearch();
    }
    if(this._closeTimer) {
      window.removeEventListener("dragover", this._closeTimer, false);
      this._closeTimer = null;
    }
  },

  _closeTimer: null,

  RDFService: Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService),
  onDragStart: function(event, transferData, action) {
    var target = event.target;
    if(target.getAttribute("anonid") == "open-engine-manager")
      return;
    transferData.data = new TransferData();
    if(organizeSE.hasClass(target, "addengine-item")) {
      transferData.data.addDataForFlavour("application/x-moz-search-engine-to-add", target.label);
    } else if(organizeSE.hasClass(target, "searchbar-engine-"+target.nodeName)) {
      transferData.data.addDataForFlavour("application/x-moz-search-engine", target.id);
    }
  },
  onDragOver: function(event, flavour, session) {
    var target = event.target;
    var type = flavour.contentType;
    var dropNode = this.getDropTarget(target);

    if(this._closeTimer) {
      window.removeEventListener("dragover", this._closeTimer, false);
      this._closeTimer = null;
    }

    this.closePopups(target);
    var popup = target.parentNode, dropDir = 0;

    // from http://mxr.mozilla.org/mozilla-central/source/browser/components/places/content/menu.xml
    // Autoscroll the popup strip if we drag over the scroll buttons
    var anonid = event.originalTarget.getAttribute("anonid");
    var scrollDir = anonid == "scrollbutton-up" ? -1 :
                    anonid == "scrollbutton-down" ? 1 : 0;
    if(scrollDir != 0) {
      event.target.firstChild._scrollBox.scrollByIndex(scrollDir);
      session.canDrop = false;

      if(popup._indicatorBar) // hide any existing dnd feedback
        popup._indicatorBar.hidden = true;
    } else {
      // drag & drop feedback
      if(this.isEngineType(type)) {
        session.canDrop = this.overPopup(target) && dropNode != session.sourceNode;

        dropDir = this.getDropDir(event);
        // again from menu.xml
        // Check if we should hide the drop indicator for this target
        if(session.canDrop && popup._indicatorBar) {
          if(target.nodeName == "menu" && dropDir == 0) {
            popup._indicatorBar.hidden = true;
          } else {
            // We should display the drop indicator relative to the arrowscrollbox
            var sbo = popup._scrollBox.scrollBoxObject;
            var newMarginTop = 0;
            if(scrollDir == 0) {
              if(dropDir == 1 && dropNode.nextSibling)
                dropNode = dropNode.nextSibling;
              newMarginTop = dropNode ? dropNode.boxObject.screenY - sbo.screenY :
                                        sbo.height;
            } else if(scrollDir == 1)
              newMarginTop = sbo.height;

            // set the new marginTop based on arrowscrollbox
            newMarginTop += sbo.y - popup._scrollBox.boxObject.y;
            popup._indicatorBar.firstChild.style.marginTop = newMarginTop + "px";
            popup._indicatorBar.hidden = false;
          }
        }

        session.dragAction = Ci.nsIDragService.DRAGDROP_ACTION_MOVE;

        if(dropDir != 0)
          target.removeAttribute("_moz-menuactive");
      } else {
        session.canDrop = organizeSE.hasClass("searchbar-engine-menuitem") ||
                          this.overButton(target);
        session.dragAction = Ci.nsIDragService.DRAGDROP_ACTION_COPY; // is copy correct?

        if(target.nodeName == "menu" || target.nodeName == "menuitem")
          target.setAttribute("_moz-menuactive", "true");
      }
    }

    if(target.nodeName == "menu" && target.getAttribute("open") != "true")
      target.firstChild.showPopup();
  },
  onDragExit: function(event, session) {
    var target = event.target;
    if(target.nodeName == "menu" || target.nodeName == "menuitem")
      target.removeAttribute("_moz-menuactive");
    if(target.parentNode._indicatorBar)
      target.parentNode._indicatorBar.hidden = true;

    if((!event.relatedTarget || !this.isOurElement(event.relatedTarget)) &&
       !this._closeTimer) {
      var closeTime = new Date().getTime() + this.springLoadedMenuDelay;
      var This = this;
      this._closeTimer = function(event) {
        if(closeTime < new Date().getTime() && !This.isOurElement(event.target)) {
          window.removeEventListener("dragover", This._closeTimer, false);
          organizeSE.popup.hidePopup();
        }
      };
      window.addEventListener("dragover", this._closeTimer, false);
    }
  },
  onDrop: function(event, dropData, session) {
    var target = this.getDropTarget(event.target);
    this.onDragExit(event, session);

    var type = dropData.flavour.contentType;
    if(this.isEngineType(type)) {
      var SEOrganizer = organizeSE.SEOrganizer;

      var parent = null, index;
      var drop = this.RDFService.GetResource(target.id);
      var dropDir = this.getDropDir(event);
      if(SEOrganizer.isFolder(drop) && dropDir == 0) {
        parent = drop;
        index = -1;
      } else {
        parent = SEOrganizer.getParent(drop);
        index = SEOrganizer.indexOf(drop, false) + Math.max(0, dropDir);
      }

      if(type == "application/x-moz-search-engine-to-add") {
        var source = session.sourceNode;
        // let the service move the new engine to the correct position
        SEOrganizer.wrappedJSObject._engineFolders[source.getAttribute("title")] = parent.ValueUTF8;
        SEOrganizer.wrappedJSObject._engineIndexes[source.getAttribute("title")] = index;
        // the handler for this event will add the engine
        var evt = document.createEvent("XULCommandEvent");
        evt.initCommandEvent("command", true, true, window, 1, false, false,
                             false, false, event);
        evt.__defineGetter__("originalTarget", function() source); // xxx
        organizeSE.searchbar.dispatchEvent(evt);
      } else {
        // don't let the template builder handle our changes - this would close
        // some of the menupopups and move "open in tabs" and "manage engines" randomly
        SEOrganizer.RemoveObserver(organizeSE.popupset.builder.datasource);

        var item = this.RDFService.GetResource(dropData.data);
        var containerUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                               .getService(Ci.nsIRDFContainerUtils);
        var oldContainer = containerUtils.MakeSeq(SEOrganizer, SEOrganizer.getParent(item));
        var newContainer = containerUtils.MakeSeq(SEOrganizer, parent);
        if(oldContainer.Resource.ValueUTF8 == parent.ValueUTF8 &&
           oldContainer.IndexOf(item) < index)
          index = index - 1;

        oldContainer.RemoveElement(item, true);
        if(index < 0 || index > newContainer.GetCount() + 1)
          newContainer.AppendElement(item, true);
        else
          newContainer.InsertElementAt(item, index, true);

        // do the moving manually:
        var parentNode = document.getElementById(parent.ValueUTF8).lastChild;
        var node = document.getElementById(item.ValueUTF8);
        node.parentNode.removeChild(node);
        index = index - 1; // here we have zero-based indizes
        var lastEngineNode = this.getDropTarget(parentNode.lastChild);
        var lastEngineIndex = [].lastIndexOf.call(parentNode.childNodes, lastEngineNode);
        if(index < 0) index = Number.POSITIVE_INFINITY;
        parentNode.insertBefore(node, parentNode.childNodes[Math.min(index, lastEngineIndex + 1)]);

        // re-register the observer
        SEOrganizer.AddObserver(organizeSE.popupset.builder.datasource);
      }

      organizeSE.popup.addEventListener("popuphidden", this.onClose, false);
    } else {
      organizeSE.popup.hidePopup();

      if(dropData.type == "application/x-moz-file")
        dropData = { data: dropData.leafName };
      else if(type != "text/unicode" && type != "text/x-moz-url")
        return;
      if(this.overButton(target)) {
        var searchbar = organizeSE.searchbar;
        searchbar.value = dropData.data;
        var evt = document.createEvent("Event");
        evt.initEvent("textentered", true, true);
        searchbar._textbox.dispatchEvent(evt);
      } else {
        var engine;
        if(hasClass(target, "openintabs-item"))
          target = target.parentNode.parentNode;
        if(target.nodeName == "menuitem" && hasClass(target, "searchbar-engine-menuitem")) {
          engine = target.engine;
        } else if(target.nodeName == "menu") {
          var folder = Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService)
                         .GetResource(target.id);
          engine = organizeSE.SEOrganizer.folderToEngine(folder);
        }
        var where = whereToOpenLink(event, true, true);
        if(where == "current") where = "tab";
        organizeSE.searchbar.doSearch(dropData.data, where, engine);
      }
    }
    function hasClass(elem, className) organizeSE.hasClass(elem, className);
  },

  onClose: function(event) {
    if(event.target != event.currentTarget)
      return;

    // popup closed after some kind of drag & drop action, save changes
    organizeSE.SEOrganizer.saveChanges();
    event.target.removeEventListener("popuphidden", arguments.callee, false);
  },

  getSupportedFlavours: function() {
    var flavours = new FlavourSet();
    flavours.appendFlavour("application/x-moz-search-engine-to-add");
    flavours.appendFlavour("application/x-moz-search-engine");
    flavours.appendFlavour("text/unicode");
    flavours.appendFlavour("text/x-moz-url");
    flavours.appendFlavour("application/x-moz-file", "nsIFile");
    return flavours;
  },

  isOurElement: function(target) {
    return this.overPopup(target) || this.overButton(target);
  },
  overPopup: function(target) {
    do {
      if(target.id == "search-popup")
        return true;
    } while((target = target.parentNode) &&
            (target.nodeType == target.ELEMENT_NODE));
    return false;
  },
  overButton: function(target) {
    do {
      if(target.getAttribute("anonid") == "searchbar-engine-button")
        return true;
    } while((target = target.parentNode) &&
            (target.nodeType == target.ELEMENT_NODE));
    return false;
  },
  getDropTarget: function(elem) {
    if(elem.nodeName == "menupopup")
      elem = elem.lastChild;
    while(elem) {
      if(organizeSE.hasClass(elem, "searchbar-engine-" + elem.nodeName))
        break;
      elem = elem.previousSibling;
    }
    return elem;
  },
  getDropDir: function(event) {
    var target = this.getDropTarget(event.target);
    if(!target) return 0;
    var sbo = target.parentNode._scrollBox.scrollBoxObject;

    if(!organizeSE.hasClass(target, "searchbar-engine-" + target.nodeName))
      return -1;

    var eventY = event.layerY;
    var nodeY = target.boxObject.y - sbo.y;
    var nodeHeight = target.boxObject.height;

    if(target.tagName == "menu") {
      if(eventY - nodeY < nodeHeight * 0.25)
        return -1; // drop above
      else if (eventY - nodeY < nodeHeight * 0.75)
        return 0; // drop in
      return 1; // drop below
    }

    if(eventY - nodeY < nodeHeight / 2)
      return -1; // drop above
    return 1; // drop below
  },
  isEngineType: function(type) {
    return type == "application/x-moz-search-engine-to-add" ||
           type == "application/x-moz-search-engine";
  },


  closePopups: function(target) {
    var now = (new Date()).getTime();

    // collect all menus the mouse is hovering
    var mouseOver = [], currentTarget = target;
    do {
      if(currentTarget.nodeName == "menu")
        mouseOver.push(currentTarget);
    } while((currentTarget = currentTarget.parentNode) &&
            (currentTarget.nodeType == currentTarget.ELEMENT_NODE));

    // don't close any of the menus the mouse is hovering
    this.hoveredItems = this.hoveredItems.filter(function(elem, index, array) {
      var item = elem.item;
      if(!item)
        return false;
      do {
        if(mouseOver.indexOf(item) != -1)
          return false;
      } while((item = item.parentNode) && (item.nodeType == item.ElEMENT_NODE));
      return true;
    });

    // close those menus that haven't been hovered in the last x millisecons
    for(var i = this.hoveredItems.length; --i > -1;) {
      if(this.hoveredItems[i].time > now - this.springLoadedMenuDelay)
        break;
      if(this.hoveredItems[i].item) {
        this.closePopup(this.hoveredItems[i].item);
        this.hoveredItems.splice(i, 1);
      }
    }

    // update list with current menu
    this.hoveredItems = this.hoveredItems.concat(mouseOver.map(function(menu) ({item: menu, time: now}) ));
  },
  closePopup: function (aTarget) {
    if(aTarget.nodeName == "menupopup")
      aTarget = aTarget.parentNode;
    if(!aTarget || (aTarget.nodeName != "menu" && aTarget.nodeName != "popupset"))
      return;
    var children = organizeSE.evalXPath("descendant::xul:menu[@open='true']",
                                        aTarget);
    children.push(aTarget);
    for(var i = 0; i < children.length; ++i) {
      if(children[i] && children[i].getAttribute("open") == "true") {
        if(children[i].lastChild.hidePopup)
          children[i].lastChild.hidePopup();
        children[i].removeAttribute("open");
      }
    }
  }
};