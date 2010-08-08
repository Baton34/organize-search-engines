/* -*- js-standard: mozdomwindow,chromewindow,mozscript;
       js-import:browserDragDrop.js,browserExtCompat.js;
       js-var:oDenDZones_Observer;                        -*- */
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

var organizeSE;
function SEOrganizer() {
  window.addEventListener("load", function(e) organizeSE.init(e), false);
  window.addEventListener("unload", this.uninit, false);
};
SEOrganizer.prototype = {
  /* "api" */
  getAllMenuitems: function() {
    return this.getChildItems(this.popup);
  },
  getChildItems: function(parent) {
    return parent.getElementsByClassName('searchbar-engine-menuitem');
  },

  evalXPath: function(aExpression, aScope, aNSResolver) {
    var resolver = aNSResolver || function resolver(prefix) {
      switch(prefix) {
        case "html": return "http://www.w3.org/1999/xhtml";
        case "xbl":  return "http://www.mozilla.org/xbl";
        case "rdf":  return "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
        case "xul":
        default:     return "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
      }
    };
    var scope = aScope || document;
    var doc = (scope.nodeName == "#document") ? scope : scope.ownerDocument;
    var result = doc.evaluate(aExpression, scope, resolver,
                              XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    function iter() { var e; while((e = result.iterateNext())) yield e; }
    return [i for each(i in iter())];
  },

  init: function init() {
    /* compatibility to other extensions */
    this.extensions = new organizeSE__Extensions();

    seOrganizer_dragObserver.init(); // drag 'n' drop stuff

    // this has already been called from the searchbar binding, but at that
    this.customizeToolbarListener(); // time there were no registered listeners

    const SORT_DIRECTION_PREF = "extensions.seorganizer.sortDirection";
    var prefs = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Ci.nsIPrefService).getBranch(SORT_DIRECTION_PREF);
    prefs.QueryInterface(Ci.nsIPrefBranch2).addObserver("", this, false);

    var popupset = this.popupset;
    popupset.setAttribute("sortDirection", prefs.getCharPref(""));
    popupset.builder.addListener(this.buildObserver);
    popupset.builder.rebuild();
  },

  _customizeToolbarListeners: [ function() {
    this.searchbar._textbox.openSearch = function() {
      // Don't open search popup if history popup is open
      if(this.popupOpen)
        return true;
      // click the button to open the *external* popup
      document.getBindingParent(this).searchButton.click();
      return false;
    };
  }],
  // this is called from init() and from the searchbar binding
  customizeToolbarListener: function() {
    var listeners = organizeSE._customizeToolbarListeners;
    for(var i = 0; i < listeners.length; i++) {
      try {
        listeners[i].call(organizeSE);
      } catch(e) {
        Components.reportError(e);
      }
    }
  },

  uninit: function uninit() {
    organizeSE.popupset.builder.removeListener(organizeSE.buildObserver);
    const SORT_DIRECTION_PREF = "extensions.seorganizer.sortDirection";
    Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService)
      .getBranch(SORT_DIRECTION_PREF).QueryInterface(Ci.nsIPrefBranch2)
      .removeObserver("", organizeSE);
    window.removeEventListener("unload", uninit, false);
    for(var i in organizeSE)
      delete organizeSE[i];
    window.organizeSE = null;
  },

  extensions: null,

  _insertItemsHandlers: [ {
    mod: null,
    insertMethod: "insertAddEngineItems",
    removeMethod: "removeAddEngineItems",
    pos: "before",
    subFolders: false
  }, {
    mod: null,
    insertMethod: "insertOpenInTabsItems",
    removeMethod: "removeOpenInTabsItems",
    pos: "after",
    subFolders: true
  } ],
  _callDynamicHandlers: function(pos, popup, isSubFolder, methodName) {
    var handlers = this._insertItemsHandlers;
    for(var i = 0; i < handlers.length; ++i) {
      if(handlers[i].pos != pos || handlers[i].subFolders != isSubFolder)
        continue;
      try {
        if(handlers[i].mod)
          handlers[i][methodName].call(handlers[i].mod, popup);
        else
          this[handlers[i][methodName]](popup);
      } catch(e) { Components.reportError(e); }
    }
  },
  insertDynamicItems: function insertDynamicItems(toplevel, popup) {
    this._callDynamicHandlers("before", popup, !toplevel, "insertMethod");
    if(toplevel) this.insertManageEngineItems(popup);
    this._callDynamicHandlers("after", popup, !toplevel, "insertMethod");
  },
  removeDynamicItems: function removeDynamicItems(toplevel, popup) {
    this._callDynamicHandlers("before", popup, !toplevel, "removeMethod");
    if(toplevel) this.removeManageEngineItems(popup);
    this._callDynamicHandlers("after", popup, !toplevel, "removeMethod");
  },
  insertManageEngineItems: function insertManageEnginesItems(popup) {
    var sep = document.getElementById("manage-engines-menuseparator").cloneNode(true);
    sep.id += "-live";
    popup.appendChild(sep);
    var item = document.getElementById("manage-engines-item").cloneNode(true);
    item.id += "-live";
    popup.appendChild(item);
  },
  removeManageEngineItems: function removeManageEngineItems(popup) {
    this._cleanUpPopupID("manage-engines-menuseparator-live");
    this._cleanUpPopupID("manage-engines-item-live");
  },
  insertAddEngineItems: function insertAddEngineItems(popup) {
    var addengines = getBrowser().mCurrentBrowser.engines;
    if(!addengines || !addengines.length) return;

    this.createSeparator(popup, "addengine-separator");
    // Insert the "add this engine" items.
    var stringBundle = this.searchbar._stringBundle, engineInfo, attrs, label;
    const CLASS_NAME = "menuitem-iconic addengine-item";
    for(var i = 0; i < addengines.length; i++) {
      engineInfo = addengines[i];
      attrs = {uri: engineInfo.uri, src: engineInfo.icon, title: engineInfo.title};
      label = stringBundle.getFormattedString("cmd_addFoundEngine", [attrs.title]);
      this.createMenuitem(label, popup, CLASS_NAME, "", attrs);
    }
  },
  removeAddEngineItems: function removeAddEngineItems(popup) {
    this._cleanUpPopupClass("addengine-item", popup);
    this._cleanUpPopupClass("addengine-separator", popup);
  },
  insertOpenInTabsItems: function insertOpenInTabsItems(popup) {
    if(this.getChildItems(popup).length <= 1) return;


    var label = gNavigatorBundle.getString("menuOpenAllInTabs.label");
    var attrs = {
      selected: (this.SEOrganizer.currentEngine.name == popup.parentNode.label)
    };
    this.createSeparator(popup, "openintabs-separator");
    this.createMenuitem(label, popup, "openintabs-item", "", attrs);
  },
  removeOpenInTabsItems: function removeOpenInTabsItems(popup) {
    this._cleanUpPopupClass("openintabs-item", popup);
    this._cleanUpPopupClass("openintabs-separator", popup);
  },
  _cleanUpPopupClass: function(className, popup) {
    var elems = popup.getElementsByClassName(className);
    for(var i = elems.length; i--;) {
      elems[i].parentNode.removeChild(elems[i]);
    }
  },
  _cleanUpPopupID: function(id) {
    for(var item; (item = document.getElementById(id));)
      item.parentNode.removeChild(item);
  },

  get searchbar() {
    return document.getElementById("searchbar");
  },
  get popup() {
    return document.getElementById("search-popup");
  },
  get popupset() {
    return document.getElementById("search-popupset");
  },
  get template() {
    return document.getElementById("searchbar-template");
  },
  _seo: null,
  get SEOrganizer() {
    if(!this._seo) {
      this._seo = Cc["@mozilla.org/rdf/datasource;1?name=organized-internet-search-engines"]
                    .getService().wrappedJSObject;
    }
    return this._seo;
  },

  buildObserver: { /* nsIXULBuilderListener */
    popupHidden: function observe__popuphidden(e) {
      organizeSE.removeDynamicItems((e.target == e.currentTarget), e.target);
      if(e.target == e.currentTarget)
        organizeSE.searchbar.searchButton.removeAttribute("open");
      organizeSE._cleanUpPopupID("empty-menuitem");
    },
    popupShowing: function observe__popupshowing(event) {
      var target = event.target;
      // code taken from Firefox' bookmarksMenu.js::showEmptyItem
      // not reusing that method to remain compatible to places
      if(!target.childNodes.length) {
        var EmptyMsg = (PlacesUIUtils || PlacesUtils).getString("bookmarksMenuEmptyFolder");
        organizeSE.createMenuitem(EmptyMsg, target, null, "empty-menuitem",
                                  { disabled: "true" });
      } else {
        var topLevel = (target == event.currentTarget);
        // when the popup is hidden and shown back-to-back, popuphidden isn't
        organizeSE.removeDynamicItems(topLevel, target); // fired sometimes
        organizeSE.insertDynamicItems(topLevel, target);
        if(topLevel) organizeSE.searchbar.searchButton.setAttribute("open", "true");
      }
    },
    onCommand: function onCommand(event) {
      var target = event.originalTarget, searchbar = document.popupNode;
      while(searchbar && searchbar.nodeName != "searchbar")
        searchbar = searchbar.parentNode;
      if(!searchbar) return;
      if(target.getAttribute("anonid") == "open-engine-manager") {
        searchbar.openManager(event);
        return;
      } else if(organizeSE.hasClass(target, "openintabs-item")) {
        var folder = target.parentNode.parentNode.id;
        folder = Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService)
                   .GetResource(folder);
        target.engine = organizeSE.SEOrganizer.folderToEngine(folder);
      } else if(target.engine) { // do nothing special
      } else if(organizeSE.hasClass(target, "searchbar-engine-menuitem") ||
                organizeSE.hasClass(target, "addengine-item")) {
        target.engine = organizeSE.SEOrganizer.getEngineByName(target.label);
      } else { // huh? how did we get here?
        return;
      }
      var evt = document.createEvent("XULCommandEvent");
      evt.initCommandEvent("command", true, true, window, 1, event.ctrlKey,
                           event.altKey, event.shiftKey, event.metaKey, event);
      evt.__defineGetter__("originalTarget", function() target);// xxx
      searchbar.dispatchEvent(evt);
    },
    mouseMove: function observe__mouseMove(event) { // hover effect for the button
      var domUtils = Cc["@mozilla.org/inspector/dom-utils;1"].getService(Ci.inIDOMUtils);
      domUtils.setContentState(organizeSE.searchbar.searchButton, 4);
    },
    didRebuild: function observe__didRebuild() {
      var popup = organizeSE.popupset.lastChild;
      popup.id = "search-popup";
      popup.className = "searchbar-popup";
      popup.setAttribute("anonid", "searchbar-popup");
      popup.position = "after_start";
      popup.addEventListener("command", this.onCommand, false);
      popup.addEventListener("popuphidden", this.popupHidden, false);
      popup.addEventListener("popupshowing", this.popupShowing, false);
      popup.addEventListener("mousemove", this.mouseMove, false);
    },
    willRebuild: function observe__willRebuild() { },
    QueryInterface: function observe__QueryInterface(aIID) {
      if(aIID.equals(Ci.nsISupports) || aIID.equals(Ci.nsIXULBuilderListener))
        return this;
      throw Cr.NS_ERROR_NO_INTERFACE;
    }
  },
  createSeparator: function(parentNode, className, id) {
    const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    var element = document.createElementNS(XUL_NS, "menuseparator");
    if(id)         element.setAttribute("id", id);
    if(className)  element.className = className;
    if(parentNode) parentNode.appendChild(element);
    return element;
  },
  createMenuitem: function(label, parentNode, className, id, attrs) {
    const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    var element = document.createElementNS(XUL_NS, "menuitem");
    element.setAttribute("label", label);
    if(id)         element.setAttribute("id", id);
    if(className)  element.className = className;
    if(attrs)      for(var i in attrs) {
      if(attrs[i])   element.setAttribute(i, attrs[i]);
    }
    if(parentNode) parentNode.appendChild(element);
    return element;
  },
  hasClass: function(elem, className) {
    return (" "+elem.className+" ").indexOf(" "+className+" ") != -1;
  },

  _sortDirectionHandlers: [
    function(val) {
      this.popupset.setAttribute("sortDirection", val);
      this.popupset.builder.rebuild();
    }
  ],
  observe: function observe(subject, topic, verb) {
    if(topic != "nsPref:changed" || verb)
      return;

    subject.QueryInterface(Ci.nsIPrefBranch);
    var val = subject.getComplexValue("", Ci.nsISupportsString).data;
    for(var i = 0; i < this._sortDirectionHandlers.length; ++i) {
      try {
        this._sortDirectionHandlers[i].call(this, val);
      } catch(e) {
        Components.reportError(e);
      }
    }
  }
};
organizeSE = new SEOrganizer();