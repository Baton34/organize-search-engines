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

var organizeSE;
function SEOrganizer() {
  window.addEventListener("load", function(e) { organizeSE.init(e); }, false);
  window.addEventListener("unload", this.uninit, false);
};
SEOrganizer.prototype = {
  /* "api" */
  getAllMenuitems: function() {
    return this.getChildItems(this.popup);
  },
  getChildItems: function(parent) {
    if(parent.getElementsByClassName) { // minefield only
      return parent.getElementsByClassName('searchbar-engine-menuitem');
    } else { // fall back on xpath
      var xpath = "descendant::xul:menuitem[contains(concat(' ', @class, ' '),\
                                            ' searchbar-engine-menuitem ')]";
      return this.evalXPath(xpath, parent);
    }
  },

  evalXPath: function(aExpression, aScope, aNSResolver) {
    var resolver = aNSResolver || function resolver(prefix) {
      switch(prefix) {
        case "html":
          return "http://www.w3.org/1999/xhtml";
        case "xbl":
          return "http://www.mozilla.org/xbl";
        case "rdf":
          return "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
        case "xul":
        default:
          return kXULNS;
      }
    };
    var scope = aScope || document;
    var doc = ((scope.nodeName == "#document") ? scope : scope.ownerDocument);
    var result = doc.evaluate(aExpression, scope, resolver,
                              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    var found = [];
    for(var i = 0; i < result.snapshotLength; ++i) {
      found.push(result.snapshotItem(i));
    }
    return found;
  },

  init: function init() {
    var toolbox = document.getElementById("navigator-toolbox");
    setTimeout(function() {
      toolbox.customizeDone = function(toolboxChanged) {
        BrowserToolboxCustomizeDone(toolboxChanged);
        if(toolboxChanged)
          organizeSE.customizeToolbarListener();
      };
    }, 0);
    this.customizeToolbarListener();

    var popupset = this.popupset;

    const SORT_DIRECTION_PREF = "extensions.seorganizer.sortDirection";
    var prefService = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefService)
                        .getBranch(SORT_DIRECTION_PREF);
    prefService.QueryInterface(Ci.nsIPrefBranch2).addObserver("", this, false);
    var direction = prefService.getComplexValue("", Ci.nsISupportsString).data;
    popupset.setAttribute("sortDirection", direction);

    popupset.builder.addListener(this.buildObserver);
    popupset.builder.rebuild();

    /* make Firefox support search aliases */
    if(!("bookmarkService" in window)) { // we aren't on a places-enabled build
      var searchRegexp = /(BMSVC\.resolveKeyword\(aURL,\saPostDataRef\))/;
      var replacement =
             "$1 ||\norganizeSE.SEOrganizer.resolveKeyword(aURL, aPostDataRef)";
      var newFuncString = getShortcutOrURI.toSource()
                                          .replace(searchRegexp, replacement);
      eval("getShortcutOrURI = " + newFuncString);
    }

    /* compatibility to other extensions */
    this.extensions = new organizeSE__Extensions();
  },
  _customizeToolbarListeners: [function() {
                                 organizeSE.onCustomizeToolbarFinished();
                               }],
  customizeToolbarListener: function() {
    var listeners = organizeSE._customizeToolbarListeners;
    for(var i = 0; i < listeners.length; i++) {
      listeners[i].call(organizeSE);
    }
  },
  // replaces Firefox' logic with our own
  _replaceSearchbarProperties: function(searchbar) {
    searchbar.rebuildPopup = this.rebuildPopup;
    searchbar.rebuildPopupDynamic = this.rebuildPopupDynamic;
    searchbar.openManager = this.openManager;
    searchbar.observe = this.searchObserve;
    searchbar._textbox.openSearch = this.openSearch;
    searchbar.__defineGetter__("_popup", this.__lookupGetter__("popup"), false);
    if(!("_engineButton" in searchbar)) { // minefield compat.
      searchbar.__defineGetter__("_engineButton", function() {
        return document.getAnonymousElementByAttribute(searchbar, "anonid",
                                                     "searchbar-engine-button");
      });
    }
    searchbar._engineButton.setAttribute("popup", "search-popup");
  },
  // we have to re-init the searchbar after customizing the toolbar
  onCustomizeToolbarFinished: function() {
    var searchbar = this.searchbar;
    if(!searchbar)
      return;

    var popup = searchbar._popup;
    this._replaceSearchbarProperties(searchbar);
    // drag 'n' drop stuff:
    seOrganizer_dragObserver.init();

    // now lets copy the manage engines items to where we need it
    var container =  document.createElementNS(kXULNS, "box");
    container.id = "searchpopup-bottom-container";
    if(!document.getElementById("manage-engines-item")) {
      container.insertBefore(popup.lastChild.cloneNode(true), container.firstChild);
      container.firstChild.removeAttribute("oncommand"); // minefield compat.
      container.firstChild.id = "manage-engines-item";
    }
    if(!document.getElementById("manage-engines-menuseparator")) {
      container.insertBefore(popup.lastChild.previousSibling.cloneNode(true), container.firstChild);
      container.firstChild.id = "manage-engines-menuseparator";
    }
    var popupset = this.popupset;
    if(popupset.firstChild.id != container.id)
      popupset.insertBefore(container, popupset.firstChild);

    popupset.builder.rebuild();

    window.setTimeout(function() {
      if(!("searchOnTab" in window) && popup.parentNode) // yeah, I know
        popup.parentNode.removeChild(popup);
    }, 1);
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

  rebuildPopup: function rebuildPopup() {
    organizeSE.popupset.builder.rebuild();
  },
  rebuildPopupDynamic: function () { this.rebuildPopup(); },
  // opens the manager in a _resizable_ window
  openManager: function openManager() {
    const wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                 .getService(Ci.nsIWindowMediator);

    var window = wm.getMostRecentWindow("Browser:SearchManager");
    if (window)
      window.focus()
    else {
      setTimeout(function () {
        openDialog("chrome://browser/content/search/engineManager.xul",
                   "_blank", "chrome,dialog,modal,centerscreen,resizable,all");
      }, 0);
    }
  },
  openSearch: function openSearch() {
    // Don't open search popup if history popup is open
    if(!this.popupOpen) {
      this._getParentSearchbar()._engineButton.click();
      return false;
    }
    return true;
  },

  _insertItemsHandlers: [ {
    mod: null,
    insertMethod: "insertAddEngineItems",
    removeMethod: "removeAddEngineItems",
    pos: "before"
  } ],
  insertDynamicItems: function insertDynamicItems() {
    const popup = organizeSE.popup;
    const manageContainer = popup.previousSibling;
    var handlers = this._insertItemsHandlers;
    for(var i = 0; i < handlers.length; ++i) {
      if(handlers[i].pos == "before") {
        try {
          if(!handlers[i].mod) {
            this[handlers[i].insertMethod](popup);
          } else {
            handlers[i].insertMethod.call(handlers[i].mod, popup);
          }
        } catch(e) { Components.reportError(e); }
      }
    }
    this.insertManageEngineItems();
    for(var i = 0; i < handlers.length; ++i) {
      if(handlers[i].pos != "before") {
        try {
          if(!handlers[i].mod) {
            this[handlers[i].insertMethod](popup);
          } else {
            handlers[i].insertMethod.call(handlers[i].mod, popup);
          }
        } catch(e) { Components.reportError(e); }
      }
    }
  },
  removeDynamicItems: function removeDynamicItems() {
    const popup = organizeSE.popup;

    // call extension handlers for extensions that are inserted /before/ manage
    const container = organizeSE.popupset.firstChild;
    var handlers = this._insertItemsHandlers;
    for(var i = 0; i < handlers.length; ++i) {
      if(handlers[i].pos == "before") {
        try {
          if(!handlers[i].mod)
            this[handlers[i].removeMethod](popup);
          else {
            handlers[i].removeMethod.call(handlers[i].mod, popup);
          }
        } catch(e) { Components.reportError(e); }
      }
    }
    this.removeManageEngineItems();
    // call extension handlers for extensions that are inserted /after/ manage
    for(var i = 0; i < handlers.length; ++i) {
      if(handlers[i].pos != "before") {
        try {
          if(!handlers[i].mod)
            this[handlers[i].removeMethod](popup);
          else {
            handlers[i].removeMethod.call(handlers[i].mod, popup);
          }
        } catch(e) { Components.reportError(e); }
      }
    }
  },
  insertManageEngineItems: function insertManageEnginesItems() {
    const popup = this.popup;
    var sep = document.getElementById("manage-engines-menuseparator").cloneNode(true);
    sep.id += "-live";
    popup.appendChild(sep);
    var item = document.getElementById("manage-engines-item").cloneNode(true);
    item.id += "-live";
    popup.appendChild(item);
  },
  removeManageEngineItems: function removeManageEngineItems() {
    const popup = this.popup;
    var item;
    while((item = document.getElementById("manage-engines-menuseparator-live")))
      item.parentNode.removeChild(item);
    while((item = document.getElementById("manage-engines-item-live")))
      item.parentNode.removeChild(item);
  },
  insertAddEngineItems: function insertAddEngineItems() {
    const popup = this.popup;
    var addengines = getBrowser().mCurrentBrowser.engines;

    if(!addengines || !addengines.length)
      return;

    const separator = document.createElementNS(kXULNS, "menuseparator");
    separator.className = "addengine-separator";
    popup.appendChild(separator);

    // Insert the "add this engine" items.
    for(var i = 0; i < addengines.length; i++) {
      var menuitem = document.createElement("menuitem");
      var engineInfo = addengines[i];
      var labelStr =
           this.searchbar._stringBundle.getFormattedString("cmd_addFoundEngine",
                                                           [engineInfo.title]);
      menuitem = document.createElementNS(kXULNS, "menuitem");
      menuitem.className = "menuitem-iconic addengine-item";
      menuitem.setAttribute("label", labelStr);
      menuitem.setAttribute("uri", engineInfo.uri);
      if(engineInfo.icon)
        menuitem.setAttribute("src", engineInfo.icon);
      menuitem.setAttribute("title", engineInfo.title);
      popup.appendChild(menuitem);
    }
  },
  removeAddEngineItems: function removeAddEngineItems() {
    const popup = organizeSE.popup;
    for(var i = 0; i < popup.childNodes.length; ++i) {
      if(popup.childNodes[i].className.indexOf("addengine-item") != -1 ||
         popup.childNodes[i].className.indexOf("addengine-separator") != -1) {
        popup.removeChild(popup.childNodes[i]);
        --i;
      }
    }
  },

  get searchbar() {
    return document.getElementById("searchbar");
  },
  get popup() {
    return document.getElementById("search-popupset").lastChild;
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
                    .getService(Ci.nsISEOrganizer).QueryInterface(Ci.nsIRDFDataSource)
                    .QueryInterface(Ci.nsIBrowserSearchService);
    }
    return this._seo;
  },

  buildObserver: { /* nsIXULBuilderListener */
    popupHidden: function observe__popuphidden(event) {
      if(event.target == event.currentTarget) {
        organizeSE.removeDynamicItems();
        organizeSE.searchbar._engineButton.removeAttribute("open");
      }
      var item = document.getElementById("empty-menuitem");
      if(item)
        item.parentNode.removeChild(item);
    },
    popupShowing: function observe__popupshowing(event) {
      if(event.target == event.currentTarget) {
        // when the popup is hidden and shown back-to-back, the popuphidden
        organizeSE.removeDynamicItems(); // event isn't fired sometimes

        organizeSE.insertDynamicItems();
        organizeSE.searchbar._engineButton.setAttribute("open", "true");
      }

      // code taken from Firefox' bookmarksMenu.js::showEmptyItem
      // not reusing that method to remain compatible to places
      if(!event.target.hasChildNodes()) {
        var EmptyMsg;
        if(BookmarksUtils)
          EmptyMsg = BookmarksUtils.getLocaleString("emptyFolder");
        else
          EmptyMsg = PlacesUtils.getString("bookmarksMenuEmptyFolder");
        var emptyElement = document.createElementNS(kXULNS, "menuitem");
        emptyElement.setAttribute("id", "empty-menuitem");
        emptyElement.setAttribute("label", EmptyMsg);
        emptyElement.setAttribute("disabled", "true");

        event.target.appendChild(emptyElement);
      }
    },
    onCommand: function onCommand(event) {
      const target = event.originalTarget;
      var searchbar = document.popupNode;
      while(searchbar && searchbar.nodeName != "searchbar")
        searchbar = searchbar.parentNode;
      if(!searchbar)
         return;
      if(target.getAttribute("anonid") == "open-engine-manager") {
        searchbar.openManager(event);
      } else if(target.className.indexOf("addengine-item") != -1 ||
                target.className.indexOf("searchbar-engine-menuitem") != -1) {
        if(!target.engine)
          target.engine = organizeSE.SEOrganizer.getEngineByName(target.label);

        if("onEnginePopupCommand" in searchbar) { // Firefox 2.0
          searchbar.onEnginePopupCommand(target);
        } else { // trunk
          var evt = document.createEvent("XULCommandEvent");
          evt.initCommandEvent("command", true, true, window, 1, false, false,
                               false, false, event);
          evt.__defineGetter__("originalTarget",function(){return target;});// xxx
          searchbar.dispatchEvent(evt);
        }
      }
    },
    didRebuild: function observe__didRebuild() {
      const popup = organizeSE.popup;
      popup.id = "search-popup";
      popup.position = "after_start";
      popup.addEventListener("command", this.onCommand, false);
      popup.addEventListener("popuphidden", this.popupHidden, false);
      popup.addEventListener("popupshowing", this.popupShowing, false);
      if(organizeSE.searchbar)
        organizeSE.searchbar._engines = organizeSE.SEOrganizer.getVisibleEngines({});
    },
    willRebuild: function observe__willRebuild() { },
    QueryInterface: function observe__QueryInterface(aIID) {
      if(aIID.equals(Ci.nsISupports) || aIID.equals(Ci.nsIXULBuilderListener))
        return this;
      throw Cr.NS_ERROR_NO_INTERFACE;
    }
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
      this._sortDirectionHandlers[i].call(this, val);
    }
  },

  _rebuildTimer: null,
  searchObserve: function observe(aEngine, aTopic, aVerb) {
    if(aTopic != "browser-search-engine-modified")
      return;

    if(aEngine)
      aEngine = aEngine.wrappedJSObject;
    if(aVerb == "engine-changed" && (!aEngine ||
       aEngine.__action == "alias" || aEngine.__action == "update")) {
      return; // ignore
    }

    if(aVerb == "engine-removed" || (aVerb == "engine-changed" &&
       aEngine.__action == "hidden" && aEngine.hidden)) {
      this.offerNewEngine(aEngine);
    } else if(aVerb == "engine-added" || (aVerb == "engine-changed" &&
              aEngine.__action == "hidden" && !aEngine.hidden)) {
      this.hideNewEngine(aEngine);
    } else if(aVerb == "engine-current" ||
             (aVerb == "engine-changed" && aEngine.__action == "icon")) {
      this.updateDisplay();
    } else if(aVerb == "-engines-organized" && "oDenDZones_Observer" in window) {
      window.setTimeout(function() { oDenDZones_Observer.observe(); }, 0);
    } /*else if(aVerb == "engine-changed" && aEngine.__action == "move") {
       // do nothing special
    }*/

    // when the manager window is closed, there'll be dozens of notifications
    // rebuilding the template for all of these is too slow
    if(this._rebuildTimer)
      window.clearTimeout(this._rebuildTimer);
    this._rebuildTimer = window.setTimeout(function(This) {
      This._popup.hidePopup();
      This.rebuildPopup();
      This._rebuildTimer = null;
    }, 100, this);
  }
};
organizeSE = new SEOrganizer();