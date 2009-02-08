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

var organizeSE__Extensions = function organizeSE__Extensions() {
  this.init();
};
organizeSE__Extensions.prototype = {
  init: function() {
    // using setTimeout(func.apply) doesn't work, so we use this wrapper function
    function applyWrapper(func, thisObj, otherArgs) {
      return func.apply(thisObj, (otherArgs || []));
    }
    var sortDirection = organizeSE.popupset.getAttribute("sortDirection");
    for each(var i in this) {
      if(typeof i == "object" && i.check) {
        if("wait" in i)
          setTimeout(applyWrapper, i.wait, i.init, i, []);
        else
          i.init();

        if("sortDirectionHandler" in i) {
          i.sortDirectionHandler(sortDirection);
          organizeSE._sortDirectionHandlers.push(i.sortDirectionHandler);
        }
        if("insertItemsHandler" in i) {
          i.insertItemsHandler.mod = i;
          organizeSE._insertItemsHandlers.push(i.insertItemsHandler);
        }
        if("customizeToolbarHandler" in i)
          organizeSE._customizeToolbarListeners.push(i.customizeToolbarHandler);
        if(!("subFolders" in i))
          i.subFolders = false;
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
   **         @optional method subFolders: if true, insertMethod/removeMethod **
   **            are not called for the root folder but for child folders.    **
   **   @optional method customizeToolbarHandler: this is called when some    **
   **     element in the toolbar is rebuilt, probably because the toolbars    **
   **     were customized. You may also want to call this method from init.   **
   ****************************************************************************/

  /*** Auto Context ***/
  autocontext: {
    get check() {
      return ("gOverlayAutoContext" in window);
    },
    sortDirectionHandler: function sortDirectionHandler(newVal) {
      const menu = document.getElementById("autocontext-searchmenu");        
      menu.setAttribute("sortDirection", newVal);
    },
    init: function() {
      const menu = document.getElementById("autocontext-searchmenu");
      menu.addEventListener("popupshowing", this.onPopupShowing, true);
      gOverlayAutoContext.loadSearch = this.getSearch();
    },
    getSearch: function() {
      var origSearch = gOverlayAutoContext.loadSearch;
      return function (aEvent) {
        const target = aEvent.target;
        target.engine = organizeSE.SEOrganizer.getEngineByName(target.label);
        origSearch.apply(this, arguments);
      };
    },
    onPopupShowing: function(event) {
      if(event.target == event.currentTarget) {
        event.target.id = "autocontext-searchmenupopup";
        const menu = document.getElementById("autocontext-searchmenu");        
        menu.builder.rebuild();
      } else {
        event.stopPropagation();
      }
    }
  },
  /*** Context Search ***/
  contextSearch: {
    get check() {
      return ("contextsearch" in window);
    },
    sortDirectionHandler: function sortDirectionHandler(newVal) {
      contextsearch.contextitem.setAttribute("sortDirection", newVal);
    },
    init: function() {
      contextsearch.rebuildmenu = function() { };
      const menu = document.getElementById("context-searchmenu");
      menu.addEventListener("popupshowing", this.onPopupShowing, true);
      contextsearch.search = this.getSearch();
    },
    getSearch: function() {
      var origSearch = contextsearch.search;
      return function (aEvent) {
        const target = aEvent.target;
        target.engine = organizeSE.SEOrganizer.getEngineByName(target.label);
        origSearch.apply(this, arguments);
      };
    },
    onPopupShowing: function(event) {
      if(event.target == event.currentTarget) {
        event.target.id = "context-searchpopup";
        contextsearch.contextitem.builder.rebuild();
      } else {
        event.stopPropagation();
      }
    }
  },

  /*** searchOnTab ***/
  searchOnTab: {
    get check() {
      return ("searchOnTab" in window);
    },
    wait: 0,
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
    init: function organizeEngines__searchOnTab__init() {
      var container = document.getElementById("searchpopup-bottom-container");
      var sot_item = document.getElementById("sot_menuitem");
      var sot_separator = sot_item.nextSibling;
      sot_separator.id = "sot_separator";
      container.insertBefore(sot_item, container.firstChild);
      container.insertBefore(sot_separator, container.firstChild);

      var popup = document.getAnonymousElementByAttribute(organizeSE.searchbar,
                                                   "anonid", "searchbar-popup");
      popup.parentNode.removeChild(popup);

      window.setTimeout(function() { organizeSE.popupset.builder.rebuild(); }, 1);
    }
  },

  /*** Second Search ***/
  secondSearch: {
    get check() { return ("SecondSearch" in window); },
    init: function() {
      SecondSearch.__defineGetter__("source", function() { return organizeSE.popup; });
      this.filterPopupEvents();
      SecondSearch.initAllEngines = this.initAllEngines;
    },
    /* update sortDirection attributes as neccesary */
    sortDirectionHandler: function sortDirectionHandler(newVal) {
      document.getElementById("secondsearch_popup_all")
                             .setAttribute("sortDirection", newVal);
      document.getElementById("secondsearch_popup").parentNode
                             .setAttribute("sortDirection", newVal);
    },
    filterPopupEvents: function() {
      SecondSearch.popup.addEventListener("popupshowing", function onPopupShowing(e) {
        var parent = e.target.parentNode;
        if(parent.datasources == "rdf:organized-internet-search-engines")
          parent.builder.rebuild();
      }, false);
      SecondSearch.popup.addEventListener("popuphiding", function onPopupHiding(e) {
        const XPATH = "descendant::xul:menupopup";
        organizeSE.evalXPath(XPATH, e.target).forEach(function(elem) {
          elem.hidePopup();
        });
      }, false);
    },
    initAllEngines: function(aPopup, aParent, aReverse) {
      var popup  = aPopup || this.popup, parent = aParent || null;

      var allMenuItem = this.allMenuItem;
      if(parent) { // we're in the child menu
        this.popup.parentNode.datasources = "rdf:null";
        allMenuItem.datasources = "rdf:organized-internet-search-engines";
      } else { // we're top level
        for(var i = popup.childNodes.length; i--;) {
          if(popup.childNodes[i].hasAttribute("engineName") ||
             popup.childNodes[i].id == "secondsearch-ose-sep") {
            popup.removeChild(popup.childNodes[i]);
          }
        }

        var popupParent = popup.parentNode;
        allMenuItem.datasources = "rdf:null";
        popupParent.datasources = "rdf:organized-internet-search-engines";
        popup = popupParent.lastChild;
        popup.id = "secondsearch_popup";
        popup.insertBefore(allMenuItem, popup.firstChild);
      }

      if(this.keywords.length) {
        var range = document.createRange();
        range.selectNodeContents(popup);
        if (popup.hasChildNodes()) {
          if (popup.firstChild == allMenuitem) {
            range.setStartAfter(popup.firstChild);
          }
          else if (popup.lastChild == allMenuitem) {
            range.setEndBefore(popup.lastChild);
          }
        }
        range.deleteContents();
        range.detach();

        if (popup.hasChildNodes())
          organizeSE.createMenuseparator(popup, "secondsearch-ose-sep");

        for (var i = 0, maxi = this.keywords.length; i < maxi; i++)
        {
          var keyword = this.keywords[i];
          if (keyword.uri && parent &&
              parent.getElementsByAttribute('engineName', keyword.name+'\n'+keyword.keyword).length)
          continue;

          var attrs = { src: keyword.icon, keyword: keyword.keyword,
                        engineName: keyword.name+'\n'+keyword.keyword };
          organizeSE.createMenuitem(popup, keyword.name, 'menuitem-iconic',
                                    'secondsearch-keyword-'+encodeURIComponent(keyword.name),
                                    attrs);
        }
      }

      popup.style.MozBoxDirection = (aReverse) ? "reverse" : "";
    }
  },

  /*** Thinger ***/
  thinger: {
    _xpath: "//xul:toolbar/xul:toolbaritem[@class='thinger-item' and @thingtype='search']",
    init: function() {
      this._default = organizeSE.SEOrganizer.currentEngine.name;
      this.customizeToolbarHandler.call(organizeSE);
      var popupset = document.getElementById("search-popupset");
      popupset.addEventListener("popupshowing", this, false);
    },
    wait: 0,
    customizeToolbarHandler: function() {
      var This = organizeSE.extensions.thinger;
      var searchbars = organizeSE.evalXPath(this._xpath);
      for(var i = 0; i < searchbars.length; i++) {
        var elem = searchbars[i];
        var anon = document.getAnonymousNodes(elem);
        if(anon && anon[0])
          organizeSE._replaceSearchbarProperties(anon[0]);
      }
    },
    get check() {
      return "thinger" in window;
    },
    handleEvent: function(event) {
      if(event.type == "popupshowing") {
        var searchbar = document.popupNode;
        while(searchbar && searchbar.nodeName != "searchbar")
          searchbar = searchbar.parentNode;
        if(!searchbar)
           return;

        var popup = event.target;
        for(var i = 0; i < popup.childNodes.length; i++) {
          if(popup.childNodes[i].hasAttribute("selected"))
            popup.childNodes[i].removeAttribute("selected");
        }
        var SEOrganizer = organizeSE.SEOrganizer;
        var name = searchbar.currentEngine.name;
        var item = SEOrganizer.getItemByName(name);
        while(item) {
          var elem = document.getElementById(item.ValueUTF8);
          if(elem)
            elem.setAttribute("selected", "true");
          try {
            item = SEOrganizer.getParent(item);
          } catch(e) {
            item = null;
          }
        }
      }
    }
  },

  /* SearchLoad Options */
  searchLoad: {
    get check() { 
      return ("SearchLoad_Options" in window);
    },
    init: function() {
      var funcStr = searchLoadOptions_doSearch.toString();
      eval("var origDoSearch = function(aURL, aInNewTab, postData) {\n    var url = aURL;"
+ funcStr.substr(funcStr.indexOf("return;\n    }") + 13));
      searchLoadOptions_doSearch = function(aText, aInNewTab) {
        var submission = organizeSE.searchbar.currentEngine.getSubmission(aText, null);
        if (submission) {
          origDoSearch(submission.uri.spec, aInNewTab, submission.postData);
          if(submission instanceof Ci.nsISimpleEnumerator) {
            var list = submission;
            while(list.hasMoreElements()) {
              submission = list.getNext().QueryInterface(Ci.nsISearchSubmission);
              origDoSearch(submission.uri.spec, true, submission.postData);
            }
          }
        }
      };
    },
    insertItemsHandler: {
      pos: "after",
      insertMethod: function(popup) {
        var label = SearchLoad_Options.stringBundle.getString("searchoptions.label");
        var item = organizeSE.createMenuitem(label, popup, "open-engine-manager",
                                             "searchloadoptions-menuitem");
				item.addEventListener("command", SearchLoad_Options.optionsDialog, false);
      },
      removeMethod: function() {
        var elem = document.getElementById("searchloadoptions-menuitem");
        if(elem)
          elem.parentNode.removeChild(elem);
      }
    }
  },

  /* TabMix Plus */
  tabmix: {
    get check() {
      return ("TMP_SearchLoadURL" in window);
    },
    init: function() {
      eval("TMP_SearchLoadURL = " + TMP_SearchLoadURL.toString().replace(/return;/,
                                          "organizeSE.doSearch2(submission);"));
    }
  }
};
