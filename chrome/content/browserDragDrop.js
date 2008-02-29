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
Portions created by the Initial Developer are Copyright (C) 2006-2008
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

const seOrganizer_dragObserver = {
  init: function() {
    var searchbar = organizeSE.searchbar;
    if(!searchbar)
      return;
    var button = searchbar._engineButton;
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

  onDragOver: function(event, flavour, session) {
    if(this._closeTimer) {
      window.removeEventListener("dragover", this._closeTimer, false);
      this._closeTimer = null;
    }
    var target = event.target;
    this.closePopups(target);
    var className = " " + target.className + " ";
    session.canDrop = (className.indexOf(" searchbar-engine-menuitem ") != -1 ||
                       className.indexOf(" searchbar-engine-menu ") != -1 ||
                       this.overButton(target));
    switch(target.nodeName) {
      case "menu":
        if(target.getAttribute("open") != "true")
          target.firstChild.showPopup();
        // no break!
      case "menuitem":
        target.setAttribute("_moz-menuactive", "true");
        break;
    }
  },
  onDragExit: function(event, session) {
    var target = event.target;
    if(target.nodeName == "menu" || target.nodeName == "menuitem") {
      target.removeAttribute("_moz-menuactive");
    }
    if((!event.relatedTarget || !this.isOurElement(event.relatedTarget)) &&
       !this._closeTimer) {
      var closeTime = new Date().getTime() + this.springLoadedMenuDelay;
      var This = this;
      this._closeTimer = function(event) {
        if(closeTime < new Date().getTime() && !This.isOurElement(event.target)) {
          window.removeEventListener("dragover", This._closeTimer, false);
          organizeSE.popup.hidePopup();
        }
      }
      window.addEventListener("dragover", this._closeTimer, false);
    }
  },
  onDrop: function(event, dropData, session) {
    var target = event.target;
    this.onDragExit(event, session);
    organizeSE.popup.hidePopup();
    if(dropData instanceof Ci.nsIFile)
      dropData = { data: dropData.leafName };
    if(!dropData.data)
      return;
    if(this.overButton(target)) {
      var searchbar = organizeSE.searchbar;
      searchbar.value = dropData.data;
      var evt = document.createEvent("Event");
      evt.initEvent("textentered", true, true);
      searchbar._textbox.dispatchEvent(evt);
    } else {
      var items;
      function hasClass(className) { return organizeSE.hasClass(target, className); };
      if(hasClass("openintabs-item"))
        target = target.parentNode.parentNode;
      if(target.nodeName == "menuitem" && hasClass("searchbar-engine-menuitem")) {
        items = [event.target];
      } else if(target.nodeName == "menu") {
        items = organizeSE.getChildItems(target);
      }
      var submission, engine;
      for(var i = 0; i < items.length; ++i) {
        engine = organizeSE.SEOrganizer.getEngineByName(items[i].label);
        if(engine) {
          submission = engine.getSubmission(dropData.data, null);
          if(submission) {
            // load the first search in the current tab if the alt key was pressed
            if(!i && (event.altKey) || content.location.href == "about:blank")
              loadURI(submission.uri.spec, null, submission.postData, false);
            else
              getBrowser().loadOneTab(submission.uri.spec, null, null,
                                      submission.postData, null, false);
          }
        }
      }
    }
  },
  getSupportedFlavours: function() {
    var flavours = new FlavourSet();
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


  LOG: function(msg) {
    msg = "Organize Search Engines:   " + msg;
    var consoleService = Cc["@mozilla.org/consoleservice;1"]
                           .getService(Ci.nsIConsoleService);
    consoleService.logStringMessage(msg);
    return msg;
  },
  closePopups: function(target) {
    var now = (new Date()).getTime();
    var targets = [], currentTarget = target;
    do {
      if(currentTarget.nodeName == "menu")
        targets.push(currentTarget);
    } while((currentTarget = currentTarget.parentNode) &&
            (currentTarget.nodeType == currentTarget.ELEMENT_NODE));
    this.hoveredItems = this.hoveredItems.filter(function(elem, index, array) {
      var item = elem.item;
      if(!item)
        return false;
      do {
        if(targets.indexOf(item) != -1)
          return false;
      } while((item = item.parentNode) && (item.nodeType == item.ElEMENT_NODE));
      return true;
    });
    for(var i = this.hoveredItems.length; --i > -1;) {
      if(this.hoveredItems[i].time > now - this.springLoadedMenuDelay)
        break;
      if(this.hoveredItems[i].item) {
        this.closePopup(this.hoveredItems[i].item);
        this.hoveredItems = this.hoveredItems.slice(0, i);
      }
    }
    if(!this.hoveredItems.length || this.hoveredItems[0].item != target) {
      this.hoveredItems = [{item: target, time: now}].concat(this.hoveredItems);
    } else {
      this.hoveredItems[0].time = now;
    }
  },
  closePopup: function (aTarget) {
    if(aTarget.nodeName == "menupopup")
      aTarget = aTarget.parentNode;
    if(aTarget.nodeName != "menu" && aTarget.nodeName != "popupset")
      return;
    var children = organizeSE.evalXPath("descendant::xul:menu[@open='true']",
                                        aTarget);
    children.push(aTarget);
    for(var i = 0; i < children.length; ++i) {
      if(children[i] && children[i].getAttribute("open") == "true") {
        children[i].lastChild.hidePopup();
        children[i].removeAttribute("open");
      }
    }
  }
};
