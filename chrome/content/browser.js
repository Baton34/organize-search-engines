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
    return this.getElementsByClassName('searchbar-engine-menuitem', parent);
  },

  getElementsByClassName: function(className, parent) {
    if("getElementsByClassName" in (parent || document)) { // minefield only
      return (parent || document).getElementsByClassName(className);
    } else { // fall back on xpath
      var xpath = "descendant::*[contains(concat(' ',@class,' '),' "+className+" ')]";
      return this.evalXPath(xpath, parent || document);
    }
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
    /*function iter() { var e; while((e = result.iterateNext())) yield e; };
    return [i for each(i in iter())];*/
    result.__iterator__ = function() { return { next: function() {
      var e = result.iterateNext(); if(!e) throw StopIteration; return e;
    } }; };
    return [i for each(i in result)];
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
    this._customizeToolbarListeners.push(this.onCustomizeToolbarFinished);
    this.customizeToolbarListener();

    var popupset = this.popupset;

    const SORT_DIRECTION_PREF = "extensions.seorganizer.sortDirection";
    var prefs = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Ci.nsIPrefService).getBranch(SORT_DIRECTION_PREF);
    prefs.QueryInterface(Ci.nsIPrefBranch2).addObserver("", this, false);
    var direction = prefs.getComplexValue("", Ci.nsISupportsString).data;
    popupset.setAttribute("sortDirection", direction);

    popupset.builder.addListener(this.buildObserver);
    popupset.builder.rebuild();

    /* compatibility to other extensions */
    this.extensions = new organizeSE__Extensions();
  },
  _customizeToolbarListeners: [ ],
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
    searchbar.doSearch = this.doSearch;
    if(!("_getParentSearchbar" in searchbar._textbox))
      searchbar._textbox._getParentSearchbar = this._getParentSearchBarTrunk;
    searchbar.__defineGetter__("_popup", this.__lookupGetter__("popup"));
    if(!("_engineButton" in searchbar)) { // minefield compat.
      searchbar._engineButton = searchbar.searchButton;
    }
    searchbar._engineButton.setAttribute("popup", "search-popup");
  },
  // we have to re-init the searchbar after customizing the toolbar
  onCustomizeToolbarFinished: function() {
    var searchbar = this.searchbar;
    if(!searchbar) return;
    const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

    var popup = searchbar._popup;
    this._replaceSearchbarProperties(searchbar);
    // drag 'n' drop stuff:
    seOrganizer_dragObserver.init();

    var popupset = this.popupset;
    var container = document.getElementById("searchpopup-bottom-container");
    if(!document.getElementById("manage-engines-item")) {
      var elem = popup.getElementsByAttribute("anonid", "open-engine-manager");
      if(elem.length) {
        container.insertBefore(elem[0].cloneNode(true), container.firstChild);
        container.firstChild.removeAttribute("oncommand"); // minefield compat.
        container.firstChild.id = "manage-engines-item";
      }
    }
    if(!document.getElementById("manage-engines-menuseparator")) {
      container.insertBefore(this.createSeparator(0, 0, "manage-engines-menuseparator"),
                             container.firstChild);
    }

    popupset.builder.rebuild();

    window.setTimeout(function() {
      if(!(("searchOnTab" in window)) && popup.parentNode) // yeah, I know
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
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
    var window = wm.getMostRecentWindow("Browser:SearchManager");
    if(window) {
      window.focus()
    } else {
      setTimeout(function () {
        openDialog("chrome://browser/content/search/engineManager.xul",
                   "_blank", "chrome,dialog,modal,centerscreen,resizable,all");
      }, 0);
    }
  },
  _getParentSearchBarTrunk: function() {
    return document.getBindingParent(this);
  },
  openSearch: function openSearch() {
    // Don't open search popup if history popup is open
    if(this.popupOpen)
      return true;
    this._getParentSearchbar()._engineButton.click();
    return false;
  },
  doSearch: function doSearch(aData, aWhere) {
    var allLinks = [];
    // null parameter below specifies HTML response for search
    var submission = organizeSE.SEOrganizer.currentEngine.getSubmission(aData, null);
    allLinks.push(submission);
    //organizeSE.doSearch2(submission);
    if(submission instanceof Ci.nsISimpleEnumerator) {
      while(submission.hasMoreElements()) {
        allLinks.push(submission.getNext().QueryInterface(Ci.nsISearchSubmission));
      }
    }

    if(allLinks.length == 1) {
      openUILinkIn(allLinks[0].uri.spec, aWhere, null, allLinks[0].postData);
    } else if(aWhere == "window") {
      var win = openDialog(getBrowserURL(), "_blank", "chrome,all,dialog=no",
                           allLinks[0].uri.spec, null, null, allLinks[0].postData, false);
      // we can't use any utility functions because we want to handle post data
      win.addEventListener("load", function() {
        win.setTimeout(function() {
          for(var i = 1; i < allLinks.length; i++) {
            win.gBrowser.loadOneTab(allLinks[i].uri.spec, null, null, allLinks[i].postData,
                                    true, false);
          }
        }, 0);
      }, false);
    } else {
    // from http://mxr.mozilla.org/mozilla1.8/source/browser/components/places/content/controller.js#1333
      // Check prefs to see whether to open over existing tabs.
      var prefs = Cc["@mozilla.org/preferences-service;1"]
                    .getService(Ci.nsIPrefService).getBranch("browser.tabs.");
      var doReplace = prefs.getBoolPref("loadFolderAndReplace");
      var loadInBackground = prefs.getBoolPref("loadBookmarksInBackground");
      // Get the start index to open tabs at
      var browser = getBrowser();
      var tabPanels = browser.browsers;
      var tabCount = tabPanels.length;
      var firstIndex;
      // If browser.tabs.loadFolderAndReplace pref is set, load over all the
      // tabs starting with the first one.
      if (doReplace)
        firstIndex = 0;
      // If the pref is not set, only load over the blank tabs at the end, if any.
      else {
        for (firstIndex = tabCount - 1; firstIndex >= 0; --firstIndex)
          if (browser.browsers[firstIndex].currentURI.spec != "about:blank")
            break;
        ++firstIndex;
      }

      // Open each uri in the folder in a tab.
      var index = firstIndex;
      for (var i = 0; i < allLinks.length; i++) {
        // If there are tabs to load over, load the uri into the next tab.
        if (index < tabCount)
          tabPanels[index].loadURIWithFlags(allLinks[i].uri.spec,
                                            Ci.nsIWebNavigation.LOAD_FLAGS_NONE,
                                            null, null, allLinks[i].postData);
        // Otherwise, create a new tab to load the uri into.
        else
          browser.addTab(allLinks[i].uri.spec, null, null, allLinks[i].postData);
        ++index;
      }

      // focus the first tab if prefs say to
      if (!loadInBackground || doReplace) {
        // Select the first tab in the group.
        // Set newly selected tab after quick timeout, otherwise hideous focus problems
        // can occur because new presshell is not ready to handle events
        function selectNewForegroundTab(browser, tab) {
          browser.selectedTab = tab;
        }
        var tabs = browser.mTabContainer.childNodes;
        setTimeout(selectNewForegroundTab, 0, browser, tabs[firstIndex]);
      }

      // Close any remaining open tabs that are left over.
      // (Always skipped when we append tabs)
      for (var i = tabCount - 1; i >= index; --i)
        browser.removeTab(tabs[i]);

      // and focus the content
      content.focus();
    }
  },

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

    this.createSeparator(popup, "openintabs-separator");
    var attrs = {};
    if("BookmarksUtils" in window) {
      var label = BookmarksUtils.getLocaleString("cmd_bm_openfolder");
      attrs.accesskey = BookmarksUtils.getLocaleString("cmd_bm_openfolder_accesskey");
    } else {
      var label = gNavigatorBundle.getString("menuOpenAllInTabs.label");
      attrs.accesskey = gNavigatorBundle.getString("menuOpenAllInTabs.accesskey");
    }
    attrs.selected = (this.SEOrganizer.currentEngine.name == popup.parentNode.label);
    this.createMenuitem(label, popup, "openintabs-item", "", attrs);
  },
  removeOpenInTabsItems: function removeOpenInTabsItems(popup) {
    this._cleanUpPopupClass("openintabs-item", popup);
    this._cleanUpPopupClass("openintabs-separator", popup);
  },
  _cleanUpPopupClass: function(className, popup) {
    var elems = this.getElementsByClassName(className, popup);
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
    popupHidden: function observe__popuphidden(e) {
      organizeSE.removeDynamicItems((e.target == e.currentTarget), e.target);
      if(e.target == e.currentTarget)
        organizeSE.searchbar._engineButton.removeAttribute("open");
      organizeSE._cleanUpPopupID("empty-menuitem");
    },
    popupShowing: function observe__popupshowing(event) {
      var target = event.target;
      // code taken from Firefox' bookmarksMenu.js::showEmptyItem
      // not reusing that method to remain compatible to places
      if(!target.childNodes.length) {
        if("BookmarksUtils" in window)
          var EmptyMsg = BookmarksUtils.getLocaleString("emptyFolder");
        else
          var EmptyMsg = PlacesUtils.getString("bookmarksMenuEmptyFolder");
        organizeSE.createMenuitem(EmptyMsg, target, null, "empty-menuitem",
                                  { disabled: "true" });
      } else {
        var topLevel = (target == event.currentTarget);
        // when the popup is hidden and shown back-to-back, popuphidden isn't
        organizeSE.removeDynamicItems(topLevel, target); // fired sometimes
        organizeSE.insertDynamicItems(topLevel, target);
        if(topLevel) organizeSE.searchbar._engineButton.setAttribute("open", "true");
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
      evt.initCommandEvent("command", true, true, window, 1, false, false,
                           false, false, event);
      evt.__defineGetter__("originalTarget",function(){return target;});// xxx
      searchbar.dispatchEvent(evt);
    },
    mouseMove: function observe__mouseMove(event) { // hover effect for the button
      var domUtils = Cc["@mozilla.org/inspector/dom-utils;1"].getService(Ci.inIDOMUtils);
      domUtils.setContentState(organizeSE.searchbar._engineButton, 4);
    },
    didRebuild: function observe__didRebuild() {
      const popup = organizeSE.popup;
      popup.id = "search-popup";
      popup.position = "after_start";
      popup.addEventListener("command", this.onCommand, false);
      popup.addEventListener("popuphidden", this.popupHidden, false);
      popup.addEventListener("popupshowing", this.popupShowing, false);
      popup.addEventListener("mousemove", this.mouseMove, false);
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
      this._engines = this.searchService.getVisibleEngines({ });
      this.updateDisplay(); // maybe the current engine was removed
    } else if(aVerb == "engine-added" || (aVerb == "engine-changed" &&
              aEngine.__action == "hidden" && !aEngine.hidden)) {
      this.hideNewEngine(aEngine);
      this._engines = this.searchService.getVisibleEngines({ });
    } else if(aVerb == "engine-current" ||
              (aVerb == "engine-changed" && ["icon", "name"].indexOf(aEngine.__action) != -1)) {
      this.updateDisplay();
    } else if(aVerb == "-engines-organized") {
      this.updateDisplay();
      if("oDenDZones_Observer" in window)
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