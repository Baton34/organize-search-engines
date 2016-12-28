/* -*- js-standard: mozdomwindow,chromewindow,mozscript;
       js-import:browser.js;                              -*- */
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

function organizeSE__Extensions() {
  this.init();
}
organizeSE__Extensions.prototype = {
  init: function() {
    // using setTimeout(func.apply) doesn't work, so we use this wrapper function
    function applyWrapper(func, thisObj, otherArgs) {
      return func.apply(thisObj, (otherArgs || []));
    }
    var sortDirection = organizeSE.popupset.getAttribute("sortDirection");

    for (var i in this) {
      if(typeof this[i] == "object" && this[i].check) {
        try {
          if("wait" in this[i])
            setTimeout(applyWrapper, this[i].wait, this[i].init, this[i], []);
          else
            this[i].init();
        
          if("sortDirectionHandler" in this[i]) {
            this[i].sortDirectionHandler(sortDirection);
            organizeSE._sortDirectionHandlers.push(this[i].sortDirectionHandler);
          }
          if("insertItemsHandler" in this[i]) {
            this[i].insertItemsHandler.mod = this[i];
            if(!("subFolders" in this[i].insertItemsHandler))
              this[i].insertItemsHandler.subFolders = false;
            organizeSE._insertItemsHandlers.push(this[i].insertItemsHandler);
          }
          if("customizeToolbarHandler" in this[i])
            organizeSE._customizeToolbarListeners.push(this[i].customizeToolbarHandler);
        } catch(e) {
          Components.reportError(e);
        }
      }
    }
},
  /*****************************************************************************
   ** object properties here have these properties and methods:               **
   **   @property check: when set to false, the whole object will be ignored. **
   **   @method init: will be called by the onload event handler. Do some     **
   **     initialization stuff, e.g. set up some event listeners or replace   **
   **     an extension's orginal function/method with your own.               **
   **                                                                         **
   **   @optional method sortDirectionHandler: will be called when the sort   **
   **       direction is changed. Use this to update sortDirection attributes.**
   **   @optional property wait: defines the amount of milliseconds to wait   **
   **     before calling -> init. This becomes useful if you want to make     **
   **     sure the extension's very own onload handler has done its job       **
   **     before you begin modifying it. Usually set to 0 (zero).             **
   **   @optional property insertItemsHandler: if you want to insert menu     **
   **     items before/after the "Manage Engines" menuitem, you can set this  **
   **     to a object like this:                                              **
   **         @property pos: "before" or "after", call before/after the       **
   **           manage engines item was inserted/removed.                     **
   **         @method insertMethod: called when you should insert the menu    **
   **           items into the menu. The parent node is passed as first       **
   **           parameter.                                                    **
   **         @method removeMethod: equivalent to insertMethod, called when   **
   **            you should remove the menuitem from the DOM.                 **
   **         @optional property subFolders: insertMethod/removeMethod are    **
   **            not called for the root folder but for child folders if true **
   **   @optional method customizeToolbarHandler: this is called when some    **
   **     element in the toolbar is rebuilt, probably because the toolbars    **
   **     were customized. You may also want to call this method from init.   **
   ****************************************************************************/

  /*** Auto Context 1.4.5.6 ***/
  autocontext: {
    get check() {
      return ("gOverlayAutoContext" in window);
    },
    sortDirectionHandler: function sortDirectionHandler(newVal) {
      document.getElementById("autocontext-searchmenu").setAttribute("sortDirection", newVal);
      document.getElementById("autocontext1-searchmenu").setAttribute("sortDirection", newVal);
    },
    wait: 0,
    init: function() {
      var menu = document.getElementById("autocontext-searchmenu");
      if("onOSEcommand" in gOverlayAutoContext)
        menu.addEventListener("command", gOverlayAutoContext.onOSEcommand, true);
      menu.addEventListener("popupshowing", this.onPopupShowing, true);

      var menu1 = document.getElementById("autocontext1-searchmenu");
      menu1.addEventListener("popupshowing", this.onPopupShowing, true);
      if("onOSEcommand" in gOverlayAutoContext)
        menu1.addEventListener("command", gOverlayAutoContext.onOSEcommand, true);
      if(Services.vc.compare(acext.getExtVersion(acutils.AutoContext_ID_GUID), "1.5") < 0)
        menu1.firstChild.addEventListener("command", organizeSE.extensions.contextSearch.search, false);

      gOverlayAutoContext.loadSearch = organizeSE.extensions.contextSearch.search;
    },
    onPopupShowing: function(event) {
      organizeSE.extensions.contextSearch.onPopupShowing(event);
    }
  },
  /*** Context Search 0.4.3 ***/
  contextSearch: {
    get check() {
      return ("contextsearch" in window);
    },
    sortDirectionHandler: function sortDirectionHandler(newVal) {
      if(contextsearch.contextitem)
        contextsearch.contextitem.setAttribute("sortDirection", newVal);
    },
    wait: 0,
    init: function() {
      contextsearch.rebuildmenu = function() { };
      contextsearch.contextitem.addEventListener("popupshowing", this.onPopupShowing, true);
      contextsearch.search = this.search;
    },
    search: function(e) {
      var text, where;
      if(e.currentTarget.id == "autocontext-searchmenupopup" ||
         e.currentTarget.id == "autocontext1-searchmenupopup") {
        text = gOverlayAutoContext.getNewBrowserSelection();
        where = gOverlayAutoContext.whereToOpenLink(e, false, true);
      } else {
        text = contextsearch.getBrowserSelection(null, e);
        where = whereToOpenLink(e, false, true);
      }
	  contextsearch.contextitem.parentNode.hidePopup();
      if(where == "tabshifted") where = "tab";
      else if(where == "tab" || where == "current") where = "tabshifted";

      var target = e.target, engine;
      if(target.classList.contains("openintabs-item")) {
        var folder = target.parentNode.parentNode.id;
        folder = seOrganizer_dragObserver.RDFService.GetResource(folder);
        engine = organizeSE.SEOrganizer.folderToEngine(folder);
      } else {
        engine = organizeSE.SEOrganizer.getEngineByName(target.label);
      }
      organizeSE.doSearch(text, where, engine);
    },
    onPopupShowing: function(event) {
      if(event.target.parentNode == event.currentTarget) {
        if(event.currentTarget.id == "autocontext1-searchmenu")
          event.target.id = "autocontext1-searchmenupopup";
        else if(event.currentTarget.id == "autocontext-searchmenu")
          event.target.id = "autocontext-searchmenupopup";
        else
          event.target.id = "context-searchpopup";
        event.currentTarget.builder.rebuild();
      } else {
        organizeSE.removeOpenInTabsItems(event.target);
        organizeSE.insertOpenInTabsItems(event.target);
        event.stopPropagation();
      }
    }
  },

  /*** searchOnTab 1.0.2 ***/
  searchOnTab: {
    get check() {
      return ("searchOnTab" in window);
    },
    insertItemsHandler: {
      pos: "before",
      insertMethod: function organizeEngines__searchOnTab__ihandler(popup) {
        searchOnTab.updateMenuItemCB();
        var sep = document.getElementById("sot_separator").cloneNode(true);
        sep.id += "-live";
        popup.appendChild(sep);
        var item = document.getElementById("sot_menuitem").cloneNode(true);
        item.id += "-live";
        popup.appendChild(item);
      },
      removeMethod: function organizeEngines__searchOnTab__rhandler(container) {
        var sep = document.getElementById("sot_separator-live");
        if(sep)
          sep.parentNode.removeChild(sep);
        var item = document.getElementById("sot_menuitem-live");
        if(item)
          item.parentNode.removeChild(item);
      }
    },
    wait: 0,
    init: function organizeEngines__searchOnTab__init() {
      var container = document.getElementById("searchpopup-bottom-container");
      var sot_item = document.getElementById("sot_menuitem");
      var sot_separator = sot_item.nextSibling;
      sot_separator.id = "sot_separator";
      container.insertBefore(sot_item, container.firstChild);
      container.insertBefore(sot_separator, container.firstChild);

      if(organizeSE.searchbar) {
        var popup = document.getAnonymousElementByAttribute(organizeSE.searchbar,
                                                     "anonid", "searchbar-popup");
        popup.parentNode.removeChild(popup);
      }

      window.setTimeout(function() { organizeSE.popupset.builder.rebuild(); }, 1);
    }
  },

  /* SearchLoad Options 0.5.6 */
  searchLoad: {
    get check() {
      return ("SearchLoad_Options" in window);
    },
    init: function() {
      var funcStr = searchLoadOptions_doSearch.toString();
      funcStr = funcStr.replace(/function .+/, ""); // strip first line
      funcStr = funcStr.substr(0, funcStr.length - 1); // strip last line
      funcStr = funcStr.replace(/(if \(keyPressed\))/, "\
organizeSE.extensions.searchLoad.doSearch(aData, submission);\
$1");
      searchLoadOptions_doSearch = new Function("aData", "keyPressed",
                                                "shiftPressed", funcStr);
    },
    doSearch: function(aData, aSubmission) {
      if(aSubmission instanceof Ci.nsISimpleEnumerator) {
        organizeSE.doSearch(aData, "tabshifted", null, aSubmission);
      }
    },
    insertItemsHandler: {
      pos: "after",
      insertMethod: function(popup) {
        SearchLoad_Options.enginesPopup = popup;
        SearchLoad_Options.addMenuItem();
      },
      removeMethod: function(popup) {
        SearchLoad_Options.enginesPopup = popup;
        var node = document.getElementById("searchloadoptions-menuitem");
        if(node)
          node.parentNode.removeChild(node);
      }
    }
  },

  /* MultiSearch 1.2.2 */
  multiSearch: {
    get check() {
      return ("MultiSearch" in window);
    },
    init: function() {
      this.customizeToolbarHandler();
    },
    customizeToolbarHandler: function() {
      if(organizeSE.searchbar) {
        var funcStr = organizeSE.searchbar.doSearch.toString();
        funcStr = funcStr.replace(/(var\ssubmission)/, "this.normalDoSearch(part, 'tab', arguments[2], null);\ncontinue;\n$1");
        eval("organizeSE.searchbar.doSearch = " + funcStr);
      }
    },
    wait: 0
  }
};
