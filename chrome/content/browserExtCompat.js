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
Portions created by the Initial Developer are Copyright (C) 2006-2007
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
        if("customizeToolbarHandler" in i) {
          organizeSE._customizeToolbarListeners.push(i.customizeToolbarHandler);
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
   **   @optional method customizeToolbarHandler: this is called when some    **
   **     element in the toolbar is rebuilt, probably because the toolbars    **
   **     were customized. You have to check yourself whether it was the      **
   **     searchbar or some other element of your interest. You'll may also   **
   **     want to call this method from init.                                 **
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
    check: ("searchOnTab" in window),
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
      const container = document.getElementById("searchpopup-bottom-container");
      var sot_item = document.getElementById("sot_menuitem");
      var sot_separator = sot_item.previousSibling;
      sot_separator.id = "sot_separator";
      container.insertBefore(sot_item, container.firstChild);
      container.insertBefore(sot_separator, container.firstChild);

      const popup = organizeSE.popup;
      popup.parentNode.removeChild(popup);

      window.setTimeout(function() { organizeSE.popupset.builder.rebuild(); }, 1);
    }
  },

  /*** Second Search ***/
  secondSearch: {
    check: ("SecondSearch" in window),
    init: function() {
      SecondSearch.__defineGetter__("source",
                                    function() { return organizeSE.popup; });
      SecondSearch.getCurrentItem = this.getCurrentItem;
      SecondSearch.doSearchBy = this.getDoSearchBy();
      SecondSearch.operateSecondSearch = this.getOperateSecondSearch();
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
    getCurrentItem: function(aPopup) {
      aPopup = aPopup || this.popup;
      var active, oldActive = [null];
      do {
        active = aPopup.getElementsByAttribute('_moz-menuactive', 'true');
        if(active && active.length) {
          oldActive = active;
          aPopup = active[0];
        } else
          return oldActive[0];
      } while(active[0].nodeName == "menu");
      return active[0];
    },
    getDoSearchBy: function() {
      var origDoSearchBy = SecondSearch.doSearchBy;
      return function(aItem, aEvent) {
               aItem = aEvent.target;
               if(!aItem.hasAttribute("engineName"))
                 aItem.setAttribute("engineName", aItem.label);
               return origDoSearchBy.call(this, aItem, aEvent);
             };
    },
    getOperateSecondSearch: function() {
      var orig = SecondSearch.operateSecondSearch;
      function replacementFunc(e) {
        var allMenuItem = this.allMenuItem;
        if(allMenuItem.firstChild.shown) {
          var item = this.getCurrentItem();
          var isUpKey = false;
          switch(e.keyCode) {
            case Ci.nsIDOMKeyEvent.DOM_VK_RIGHT:
              if(item.nodeName == "menu") {
                item.firstChild.showPopup();
                item.firstChild.firstChild.setAttribute("_moz-menuactive",
                                                        "true");
                e.stopPropagation();
                e.preventDefault();
                return false;
              }
              break;
            case Ci.nsIDOMKeyEvent.DOM_VK_LEFT:
              if(item.parentNode.id != "secondsearch_popup_all") {
                item.removeAttribute("_moz-menuactive");
                item.parentNode.hidePopup();
                e.stopPropagation();
                e.preventDefault();
                return false;
              }
              break;
            case Ci.nsIDOMKeyEvent.DOM_VK_UP:
              isUpKey = true;
            case Ci.nsIDOMKeyEvent.DOM_VK_DOWN:
              // we can't use next/previousSibling because of menuseparators
              function getSibling(item, direction) {
                if(direction == -1)
                  direction = "previousSibling";
                else
                  direction = "nextSibling";
                while((item = item[direction]) && item.nodeName) {
                  if(item.nodeName == "menu" || item.nodeName == "menuitem")
                    return item;
                }
                return null;
              }
              var elem = getSibling(item, isUpKey ? -1 : 1);
              if(elem) {
                item.removeAttribute("_moz-menuactive");
                elem.setAttribute("_moz-menuactive", "true");
              }
              e.stopPropagation();
              e.preventDefault();
              return false;
          }
        }

        return orig.call(this, e);
      };
      return replacementFunc;
    },
    filterPopupEvents: function() {
      const allMenuItem = SecondSearch.allMenuItem;
      const popup = SecondSearch.popup;
      popup.removeAttribute("onpopupshowing");
      popup.removeAttribute("onpopuphiding");
      allMenuItem.firstChild.removeAttribute("onpopupshowing");
      allMenuItem.firstChild.removeAttribute("onpopuphiding");
      function onpopupEvent(e) {
        if(e.target.id == "secondsearch_popup") {
          if(e.type == "popupshowing") {
            SecondSearch.onPopupShowing(e);
          } else {
            SecondSearch.onPopupHiding(e);
          }
        } else if(e.target.parentNode.id == "secondsearch_popup_all") {
          if(e.type == "popupshowing") {
            e.target.shown = true;
            if(e.target.parentNode.datasources.indexOf("rdf:organized-internet-search-engines") != -1)
              e.target.parentNode.builder.rebuild();
            if(!SecondSearch.getCurrentItem(e.target))
              e.target.firstChild.setAttribute("_moz-menuactive", "true");
          } else {
            e.target.shown = false;
            organizeSE.evalXPath("//xul:menupopup", e.target).forEach(function(cur) {
              cur.hidePopup();
            });
          }
        }
        e.stopPropagation();
      }
      popup.addEventListener("popupshowing", onpopupEvent, false);
      popup.addEventListener("popuphiding", onpopupEvent, false);
    },
    initAllEngines: function(aPopup, aUnused, aReverse) {
      var source = this.source;
      var popup  = aPopup || this.popup;
      var offset = 0;

      var count = 0;

      var allMenuItem = this.allMenuItem;
      if(this.popupType == 0) { // we're in the child menu
        this.popup.parentNode.datasources = "";
        allMenuItem.datasources = "rdf:organized-internet-search-engines";
      } else { // we're top level
        var popupParent = popup.parentNode;
        allMenuItem.datasources = "";
        popupParent.datasources = "rdf:organized-internet-search-engines";
        popupParent.builder.rebuild();
        popup = popupParent.lastChild;
        popup.id = "secondsearch_popup";
        if(allMenuItem.parentNode != popup)
          popup.insertBefore(allMenuItem, popup.firstChild);
      }

      count = popup.childNodes.length - 1;
      if (this.keywords.length) {
        if (count)
          popup.appendChild(document.createElementNS(OSE_XUL_NS, 'menuseparator'));

        for (var i = 0, maxi = this.keywords.length; i < maxi; i++)
        {
          if (this.keywords[i].uri && parent &&
              parent.getElementsByAttribute('engineName', this.keywords[i].name+'\n'+this.keywords[i].keyword).length)
          continue;

          popup.appendChild(document.createElementNS(OSE_XUL_NS, 'menuitem'));
          popup.lastChild.setAttribute('label',      this.keywords[i].name);
          popup.lastChild.setAttribute('class',      'menuitem-iconic');
          popup.lastChild.setAttribute('src',        this.keywords[i].icon);
          popup.lastChild.setAttribute('keyword',    this.keywords[i].keyword);
          popup.lastChild.setAttribute('engineName', this.keywords[i].name+'\n'+this.keywords[i].keyword);
          popup.lastChild.id = 'secondsearch-keyword-'+encodeURIComponent(this.keywords[i].name);
          if (!count)
            popup.lastChild.setAttribute('_moz-menuactive', 'true');

          count++;
        }

        if (popup.lastChild && popup.lastChild.localName == 'menuseparator')
          popup.removeChild(popup.lastChild);
      }

      if (aReverse) {
        popup.style.MozBoxDirection = "reverse";
      } else {
        popup.style.MozBoxDirection = "";
      }
    }
  },

  /*** Thinger ***/
  thinger: {
    _xpath: "//xul:toolbar/xul:toolbaritem[@class='thinger-item' and @thingtype='search']",
    init: function() {
      this._default = organizeSE.SEOrganizer.currentEngine.name;
      var searchbars = organizeSE.evalXPath(this._xpath);
      for(var i = 0; i < searchbars.length; i++) {
        this.customizeToolbarHandler.call(organizeSE, searchbars[i]);
      }
      var popupset = document.getElementById("search-popupset");
      popupset.addEventListener("popupshowing", this, false);
    },
    wait: 0,
    customizeToolbarHandler: function(elem) {
      var This = organizeSE.extensions.thinger;
      if(This._isThingerSearchbar(elem)) {
        var anon = document.getAnonymousNodes(elem);
        if(anon && anon[0])
          organizeSE._replaceSearchbarProperties(anon[0]);
      }
    },
    get check() {
      return "thinger" in window;
    },
    _isThingerSearchbar: function(elem) {
      return (elem.className.split(" ").indexOf("thinger-item") != -1 &&
              elem.getAttribute("thingtype") == "search");
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
  }
};
