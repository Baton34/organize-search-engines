/* -*- js-standard: mozdomwindow,chromewindow,mozscript; js-import:;
       js-var:nsDragAndDrop;                                          -*- */
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

const Ci = Components.interfaces, Cc = Components.classes;

const ENGINE_FLAVOR = "text/x-moz-search-engine";
const FLAVOR_SEPARATOR = ";";
const BROWSER_SUGGEST_PREF = "browser.search.suggest.enabled";
const SORT_DIRECTION_PREF = "extensions.seorganizer.sortDirection";


const SEARCH_ENGINE_TOPIC        = "browser-search-engine-modified";

const NS = "urn:organize-search-engines#";
const NS_RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const ROOT = "urn:organize-search-engines:root";
const FOLDERS_ROOT = "urn:organize-search-engines:folders-root";

var gEngineManagerDialog, gDragObserver, gEngineView, gStrings;
var gRemovedEngines = [], gAddedEngines = [], gSortDir = "natural";

const CONTRACT_ID =
         "@mozilla.org/rdf/datasource;1?name=organized-internet-search-engines";
var gSEOrganizer;

function LOG(msg) {
  msg = "Organize Search Engines:   " + msg;
  var consoleService = Cc["@mozilla.org/consoleservice;1"]
                         .getService(Ci.nsIConsoleService);
  consoleService.logStringMessage(msg);
  //dump(msg + "\n");
  return msg;
}


function gResort(orig) {
  function sortCallback(item1, item2) {
    item1 = item1.name;
    item2 = item2.name;
    if(item1 == item2)
      return 0;
    var ret = 0;
    for(var i = 0; !ret && i < Math.min(item1.length, item2.length); ++i) {
      if(item1[i].toLowerCase() != item2[i].toLowerCase()) {
        ret = (item1[i].toLowerCase() > item2[i].toLowerCase()) ? 1 : -1;
      } else if(item1[i] != item2[i]) {
        ret = (item1[i] < item2[i]) ? 1 : -1;
      }
    }
    if(!ret) {
      ret = (item1.length > item2.length) ? 1 : -1;
    }
    return (gSortDir == "ascending") ? ret : -ret;
  }
  /* puts the separators back to where they belong to */
  function resort(unsorted, sorted) {
    sorted = sorted.filter(function(a) { return !a.isSep; });
    var elems = [];
    for(var i = 0; i < unsorted.length; ++i) {
      if(unsorted[i].isSep) {
        elems.push({sep: unsorted[i], prev: unsorted[i - 1]});
      }
    }

    var beforeArr, resultIndex;
    for(var i = 0; i < elems.length; ++i) {
      resultIndex = sorted.indexOf(elems[i].prev) + 1;
      if(resultIndex == 0) {
        sorted = [elems[i].sep].concat(sorted);
      } else {
        beforeArr = sorted.slice(0, resultIndex);
        beforeArr.push(elems[i].sep);
        sorted = beforeArr.concat(sorted.slice(resultIndex));
      }
    }
    return sorted;
  }
  return resort(orig, [].concat(orig).sort(sortCallback));
}
function compareNumbers(a, b) {
  return a - b;
}

window.addEventListener("keypress", function(event) {
  if(event.keyCode == KeyboardEvent.DOM_VK_ESCAPE) {
    document.getElementById("cmd_cancel").doCommand();
  }
}, false); // a key element is fired even when the editable tree canceled the event


function EngineManagerDialog() {
}
EngineManagerDialog.prototype = {
  _c: Components,
  init: function EngineManager__init() {
    gStrings = document.getElementById("strings");
    gSEOrganizer = Cc[CONTRACT_ID].getService(Ci.nsISEOrganizer).wrappedJSObject;

    var prefService = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefService).getBranch("");
    var suggestEnabled = prefService.getBoolPref(BROWSER_SUGGEST_PREF);
    document.getElementById("enableSuggest").setAttribute("checked", suggestEnabled);
    gSortDir = prefService.getComplexValue(SORT_DIRECTION_PREF,
                                           Ci.nsISupportsString).data;
    document.getElementById("engineName").setAttribute("sortDirection",
                                                       gSortDir);
    document.getElementById(gSortDir).setAttribute("checked", "true");

    var engineList = document.getElementById("engineList");
    engineList.view = gEngineView = new EngineView(new Structure());
    gEngineView.selection.currentIndex = gEngineView.rowCount - 1;

    // add observers:
    var os = Cc["@mozilla.org/observer-service;1"].
             getService(Ci.nsIObserverService);
    os.addObserver(this, "browser-search-engine-modified", false);

    prefService.QueryInterface(Ci.nsIPrefBranch2).addObserver("", this, false);

    this.showRestoreDefaults();

    var dlgStrings = document.getElementById("dlg-strings");
    var ok = document.getElementById("btn_ok");
    ok.setAttribute("label", dlgStrings.getString("button-accept"));
    ok.setAttribute("accesskey", dlgStrings.getString("accesskey-accept"));
    var cancel = document.getElementById("btn_cancel");
    cancel.setAttribute("label", dlgStrings.getString("button-cancel"));
    cancel.setAttribute("accesskey", dlgStrings.getString("accesskey-cancel"));
    // the button order on windows is different from linux/mac
    cancel.ordinal = (Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS == "WINNT") ? 1 : 0;

    window.setTimeout(function() {
      engineList.focus();
    }, 0);

    if(engineList.startEditing) {
      var orig = engineList.startEditing;
      engineList.startEditing = function start(row, col) {
        if(start.caller.name == "onxblclick" && gEngineView.isContainer(row))
          return; // ignore double clicks on folders, these are used for collapsing
        this.inputField.width = 0;
        orig.apply(this, arguments);
      };
    }
    engineList.addEventListener("keypress", function(event) {
      if(engineList._editingColumn) return;
      if(event.keyCode == event.DOM_VK_ENTER || event.keyCode == event.DOM_VK_RETURN) {
        if(event.shiftKey)
          document.getElementById("cmd_editalias").doCommand();
        else
          document.getElementById("cmd_rename").doCommand();
      }
    }, true);

    var suggestall = document.getElementById("suggestthemallHbox");
    if(suggestall) {
      document.documentElement.insertBefore(suggestall, engineList.parentNode.nextSibling);
    }
  },
  onOK: function EngineManager__onOK() {
    this.onClose();

    // Set the preference
    var newSuggestEnabled = document.getElementById("enableSuggest")
                                    .getAttribute("checked");
    var prefService = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefBranch);
    prefService.setBoolPref(BROWSER_SUGGEST_PREF, (newSuggestEnabled == "true"));
    var str = Cc["@mozilla.org/supports-string;1"]
                .createInstance(Ci.nsISupportsString);
    str.data = gSortDir;
    prefService.setComplexValue(SORT_DIRECTION_PREF, Ci.nsISupportsString, str);

    if("suggestthemall" in window)
      suggestthemall.onOK();

    // Commit the changes
    gEngineView.commit();
  },
  onCancel: function EngineManager__onCancel() {
    this.onClose();

    gSEOrganizer.reload();
    if(gAddedEngines.length) {
      for(var i = 0; i < gEngineView._indexCache.length; i++) {
        var engine = gEngineView._indexCache[i].originalEngine;
        if(engine && engine.wrappedJSObject.__updateToEngine)
          delete engine.wrappedJSObject.__updateToEngine;
      }
      gSEOrganizer.beginUpdateBatch();
      for(var i = gAddedEngines.length; i--;) {
        gSEOrganizer._internalRemove(gAddedEngines[i]);
      }
      gSEOrganizer.saveChanges();
      gSEOrganizer.endUpdateBatch();
    }
  },
  onClose: function EngineManager__onClose(event) {
    var Components = this._c;
    var Cc = Components.classes, Ci = Components.interfaces;
    var body = function(This) {
      // Remove the observers
      var os = Cc["@mozilla.org/observer-service;1"].
               getService(Ci.nsIObserverService);
      os.removeObserver(This, "browser-search-engine-modified");

      var branch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefService).getBranch("");
      branch.QueryInterface(Ci.nsIPrefBranch2);
      branch.removeObserver("", This);

      // notify observers
      os.notifyObservers(null, "browser-search-engine-modified",
                         "-engines-organized");
      This.onCancel = function() {};
    };
    if(window && !window.closed && !event)
      window.setTimeout(body, 0, this);
    else
      body(this);
  },
  cancel: function(event) {
    if(!gEngineView.tree.element._editingColumn) {
      closeWindow(true);
      gEngineManagerDialog.onCancel();
    }
  },

  observe: function EngineManager__observe(aSubject, aTopic, aVerb) {
    if(!window || window.closed) {
      this.onClose();
      return;
    }
    window.setTimeout(function timed_EngineManager__observe() {
      if(aTopic === "browser-search-engine-modified" &&
         aSubject instanceof Ci.nsISearchEngine) {
        var item = gEngineView._structure.find("originalEngine", aSubject);
        if(aVerb == "engine-added") {
          gEngineManagerDialog.newItem(gEngineManagerDialog.NEW_ITEM_RESTORED_DEFAULT_ENGINE,
                                       aSubject);
          gEngineView.rowCountChanged(gEngineView.lastIndex, 1);
          gEngineView.invalidate();
        } else if(aVerb == "engine-changed") {
          var change = aSubject.wrappedJSObject.__action;
          if(change == "hidden") {
            aVerb = aSubject.hidden ? "engine-removed" : "engine-added";
            timed_EngineManager__observe();
          } else if(change == "icon" && item) {
            item.iconURI = (aSubject.iconURI || {spec: ""}).spec;
            gEngineView.invalidateCell(gEngineView._indexCache.indexOf(item), "engineName");
          } else if(change == "alias" && item) {
            item.alias = aSubject.alias;
            gEngineView.invalidateCell(gEngineView._indexCache.indexOf(item), "engineAlias");
          } /*else if(change == "update" || change == "move" || change == "name") {*/
        } else if(aVerb == "engine-removed" && item) {
          var selection = gEngineView.selectedItems;
          gEngineView.select(gEngineView._indexCache.indexOf(item), true);
          gEngineManagerDialog.remove();
          for(var i = 0; i < selection.length; i++) {
            selection[i] = gEngineView._indexCache.indexOf(selection[i]);
          }
          gEngineView.select.apply(gEngineView, selection.concat([true]));
          gEngineView.invalidate();
        } // else if(aVerb == "engine-current") { }
      } else if(aTopic === "nsPref:changed") {
        var prefService = aSubject.QueryInterface(Ci.nsIPrefBranch);
        if(aVerb == BROWSER_SUGGEST_PREF) {
          var value = prefService.getBoolPref(BROWSER_SUGGEST_PREF);
          document.getElementById("enableSuggest").setAttribute("checked", value);
        } else if(aVerb == SORT_DIRECTION_PREF) {
          this.sortBy(prefService.getComplexValue(aVerb, Ci.nsISupportsString));
        }
      }
    }, 0); // we want to wait until other observers did their job
  },

  showRestoreDefaults: function EngineManager__showRestoreDefaults(someHidden) {
    if(someHidden === undefined || someHidden === null) {
      someHidden = gSEOrganizer.getDefaultEngines({}).some(function (e) {
        return !gEngineView.engineVisible(e);
      });
    }
    document.getElementById("restoreDefault").setAttribute("disabled", !someHidden);
  },

  remove: function EngineManager__remove() {
    document.getElementById("engineList").focus();
    if(gEngineView.tree.element._editingColumn) return;
    var indexes = gEngineView.selectedIndexes;
    gEngineView.selection.clearSelection();

    function RemovedItem(node) {
      this.node = node;
      var name = gSEOrganizer.getNameByItem(node);
      if(name) this.engine = gSEOrganizer.getEngineByName(name);
      gRemovedEngines.push(this);
    }

    var index, item, parent, localIndex;
    for(var k = 0; k < indexes.length; k++) {
      index = indexes[k];
      item = gEngineView._indexCache[index];
      parent = item.parent;
      localIndex = parent.children.indexOf(item);

      new RemovedItem(item.node);
      var removedCount = 1;
      if(item.isSeq) { // count removed children and add them to gRemovedEngines
        var items = [item];
        for(var i = 0; i < items.length; ++i) {
          for(var j = 0; j < items[i].children.length; ++j) {
            new RemovedItem(items[i].children[j].node);
            if(items[i].open)
              removedCount++;
            if(items[i].children[j].isSeq) {
              items.push(items[i].children[j]);
              if(!items[i].open) // don't count items in open folders in closed folders
                items[i].children[j].open = false;
            }
          }
        }
      }

      parent.children = parent.children.slice(0, localIndex)
                              .concat(parent.children.slice(localIndex + 1));
      parent.modified = parent.modified || 1;

      gEngineView.updateCache();
      gEngineView.rowCountChanged(index, -removedCount);
      gEngineView.ensureRowIsVisible(Math.min(index, gEngineView.lastIndex));
    }

    this.showRestoreDefaults();
  },
  bump: function EngineManager__bump(direction) {
    var indexes = gEngineView.selectedIndexes, items = gEngineView.selectedItems;
    if(direction > 0)
      indexes = indexes.reverse(), items = items.reverse();
    gEngineView.select(true);

    for(var i = 0; i < indexes.length; i++) {
      var localIndex = gEngineView.getLocalIndex(indexes[i]) - direction;
      items[i] = gEngineView.internalMove(items[i], items[i].parent, localIndex);
    }
    gEngineView.updateCache();
    for(var i = 0; i < indexes.length; i++) {
      gEngineView.invalidateRow(indexes[i]);
      // for folders the new index could be nearly anywhere:
      indexes[i] = gEngineView._indexCache.indexOf(items[i])
      gEngineView.invalidateRow(indexes[i]);
    }
    for(var i = 0; i < indexes.length; i++) {
      gEngineView.ensureRowIsVisible(indexes[i]);
      gEngineView.select(indexes[i], false);
    }
  },
  move: function EngineManager__move() {
    var selected = gEngineView.selectedItems;
    document.getElementById("engineList").focus();
    var canceled = {value: true}, returnVal = {};
    window.openDialog("chrome://seorganizer/content/moveTo.xul", "_blank",
                      "resizable,chrome,modal,dialog", canceled, returnVal);
    if(canceled.value) return;
    if(returnVal.value == ROOT || returnVal.value == FOLDERS_ROOT)
      var target = gEngineView._structure;
    else
      var target = gEngineView._structure.find("nodeID", returnVal.value);
    if(!target) return;

    var selectedIndexes = gEngineView.selectedIndexes;

    for(var i = 0; i < selected.length; i++) {
      if(selected[i].parent != target) {
        gEngineView.rowCountChanged(selectedIndexes[i], -1);
        selected[i] = gEngineView.internalMove(selected[i], target, -1);
      }
    }

    gEngineView.updateCache();
    var indexes = [];
    selected.forEach(function(item) {
      indexes.push(gEngineView._indexCache.indexOf(item));
    });
    indexes.forEach(function(index) {
      gEngineView.rowCountChanged(index, 1);
    });
    gEngineView.select.apply(gEngineView, indexes.concat([true]));
  },
  editAlias: function EngineManager__editAlias() {
    this._edit("alias", "editalias", "engineAlias");
  },
  editName: function EngineManager__editName() {
    this._edit("name", "rename", "engineName");
  },
  _edit: function(prop, str, colId) {
    var index = gEngineView.selectedIndex;
    var tree = gEngineView.tree.element, col = gEngineView.getNamedColumn(colId);
    if(tree._editingColumn)
      return;
    tree.startEditing(index, col);
  },

  get NEW_ITEM_TYPE_SEPARATOR()          {  return "separator";       },
  get NEW_ITEM_TYPE_FOLDER()             {  return "folder";          },
  get NEW_ITEM_RESTORED_DEFAULT_ENGINE() {  return "default-engine";  },
  newItem: function EngineManager__newItem(type, fromOriginal) {
    var treeInsertLoc = gEngineView.selectedIndex;
    var insertLoc, parent;
    if(treeInsertLoc === -1) {
      parent = gEngineView._indexCache[-1]; // root
      insertLoc = -1;
    } else if(gEngineView.isContainerOpen(treeInsertLoc)) {
      parent = gEngineView._indexCache[treeInsertLoc];
      insertLoc = -1;
    } else {
      parent = gEngineView._indexCache[treeInsertLoc].parent;
      insertLoc = gEngineView.getLocalIndex(treeInsertLoc);
    }

    var node, item;
    if(type == this.NEW_ITEM_TYPE_SEPARATOR) {
      node = gSEOrganizer.newSeparator(parent.node);
      item = new Structure__Item(parent, node);
    } else if(type == this.NEW_ITEM_TYPE_FOLDER) {
      var node = gSEOrganizer.newFolder("", parent.node);
      item = new Structure__Container(parent, node);
    } else if(type == this.NEW_ITEM_RESTORED_DEFAULT_ENGINE) {
      if(fromOriginal) {
        var engine = fromOriginal;
      } else {
        var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Ci.nsIPromptService);
        var defaults = gSEOrganizer.getDefaultEngines({}).filter(function(e) !gEngineView.engineVisible(e));
        if(!defaults.length)
          return;
        var defaultNames = [];
        for(var i = 0; i < defaults.length; ++i) {
          defaultNames[i] = defaults[i].name;
        }
        var selection = {};
        var cancel = !prompts.select(window, gStrings.getString("restore.title"),
                                     gStrings.getString("restore.content"),
                                     defaultNames.length, defaultNames, selection);
        if(cancel) return;
        var engine = defaults[selection.value];
      }
      node = gSEOrganizer.getItemByName(engine.name);
      var idx = gRemovedEngines.map(function(obj) obj.node).indexOf(node);
      if(node && idx != -1)
        gRemovedEngines = gRemovedEngines.splice(idx, 0);
      if(!node) {
        node = gSEOrganizer._getAnonymousResource();
      }
      item = new Structure__Item(parent, node, engine);
      this.showRestoreDefaults(defaults.length != 1);
    } else { throw Cr.NS_ERROR_INVALID_ARG; }
    item.modified = 2;
    parent.insertAt(insertLoc, item);
    gAddedEngines.push(node);

    gEngineView.updateCache();
    if((gSortDir == "ascending" || gSortDir == "descending") && !item.isSep) {
      parent.children = gResort(parent.children);
    }
    treeInsertLoc = gEngineView._indexCache.indexOf(item);
    gEngineView.rowCountChanged(treeInsertLoc, 1);
    gEngineView.select(treeInsertLoc, true);
    if(type == this.NEW_ITEM_TYPE_FOLDER)
      this.editName();
  },
  properties: function EngineManager__properties() {
    var item = gEngineView.selectedItem;
    openDialog("chrome://seorganizer/content/engineProperties.xul", "engineProps", "modal,dialog,centerscreen", item);
    if(!item.modified)
      item.modified = 1;
    gEngineView.invalidateRow(gEngineView.selectedIndex);
  },
  selectAll: function EngineManager__selectAll() {
    gEngineView.selection.rangedSelect(0, gEngineView.lastIndex, false);
    document.getElementById("engineList").focus();
  },
  sortBy: function EngineManager__sortBy(direction) {
    var col = document.getElementById("engineName");
    gSortDir = direction;
    col.setAttribute("sortDirection", direction);

    var elems = ["ascending", "descending", "natural"];
    for(var i = 0; i < elems.length; i++) {
      var checked = (direction == elems[i]).toString();
      document.getElementById(elems[i]).setAttribute("checked", checked);
    }

    gEngineView.invalidate();
  },

  onSelect: function EngineManager__onSelect() {
    var indexes = gEngineView.selectedIndexes;

    var disableButtons = (!indexes.length);
    var multipleSelected = (indexes.length > 1), onlyOneEngine = false;
    var lastSelected = disableButtons, firstSelected = disableButtons;
    var readOnly = multipleSelected || disableButtons;

    var index, item, engine;
    for(var i = 0; i < indexes.length; i++) {
      index = gEngineView.getLocalIndex(indexes[i]);
      item = gEngineView._indexCache[indexes[i]];
      engine = item.originalEngine ? item.originalEngine.wrappedJSObject : null;
      if(item.parent.children.length - 1 == index) lastSelected = true;
      if(!index) firstSelected = true;
      if(item.isSep) readOnly = true;
      if(item.isEngine && !readOnly)
        readOnly = !engine || (engine._readOnly && !("_serializeToJSON" in engine));
    }
    onlyOneEngine = !multipleSelected && !disableButtons && item.isEngine;

    document.getElementById("cmd_remove").setAttribute("disabled", disableButtons);

    document.getElementById("cmd_rename").setAttribute("disabled", readOnly);
    document.getElementById("cmd_move-engine").setAttribute("disabled", disableButtons);
    document.getElementById("cmd_editalias").setAttribute("disabled", !onlyOneEngine);
    document.getElementById("cmd_properties").setAttribute("disabled", !onlyOneEngine);

    document.getElementById("cmd_moveup").setAttribute("disabled", firstSelected);
    document.getElementById("cmd_movedown").setAttribute("disabled", lastSelected);
  },

  loadAddEngines: function EngineManager__loadAddEngines() {
    this.onOK();
    var win = window.opener;
    if(!("BrowserSearch" in win)) {
      win = Cc["@mozilla.org/appshell/window-mediator;1"]
              .getService(Ci.nsIWindowMediator)
              .getMostRecentWindow("navigator:browser");
    }
    win.BrowserSearch.loadAddEngines();
    window.close();
    win.focus();
  },

  startDrag: function EngineManager__startDrag(event) {
    if(event.target.localName === "treechildren")
      nsDragAndDrop.startDrag(event, gDragObserver);
  }
};
gEngineManagerDialog = new EngineManagerDialog();

var _dragData = {};
function DragObserver() {
}
DragObserver.prototype = {
  onDragStart: function (aEvent, aXferData, aDragAction) {
    var selected = gEngineView.selectedItems;
    if (!selected.length)
      return;

    var random = Math.random().toString();
    _dragData[random] = selected;
    aXferData.data = new TransferData();
    aXferData.data.addDataForFlavour(ENGINE_FLAVOR, random);

    aDragAction.action = Ci.nsIDragService.DRAGDROP_ACTION_MOVE;
  },
  onDrop: function (aEvent, aXferData, aDragSession) { },
  onDragExit: function (aEvent, aDragSession) { },
  onDragOver: function (aEvent, aFlavour, aDragSession) { },
  getSupportedFlavours: function() {
    return {
      ENGINE_FLAVOR: { iid: "nsISupportsString", width: 2 }
    };
  }
};
gDragObserver = new DragObserver();

function Structure() {
  var rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                     .getService(Ci.nsIRDFService);
  Structure__Container.call(this, null, rdfService.GetResource(ROOT));
  this.modified = 0;
}
Structure.prototype = {
  node: null,
  parent: null,
  name: "",
  isSep: false,
  iconURI: "",
  isSeq: true,
  isEngine: false,
  children: null,
  alias: "",
  modified: 0,
  destroy: function Structure__destroy() {
    this.node = this.parent = this.children = null;
  },

  isAncestorOf: function Structure__Item__isAncestorOf(item) {
    return this === item;
  }
};
function Structure__Container(parent, node, children, open) {
  this.open = open ? true : false;
  this.children = [];
  Structure__Item.apply(this, arguments); // inherit from Structure__Item

  var rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                     .getService(Ci.nsIRDFService);
  var rdfContainerUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                            .getService(Ci.nsIRDFContainerUtils);


  if(children) {
    for(var i = 0; i < children.length; ++i) {
      children[i].parent = this;
    }
    this.children = children;
  } else {
    children = gSEOrganizer.ArcLabelsOut(node);
    var instanceOf = rdfService.GetResource(NS_RDF + "instanceOf");
    var seq = rdfService.GetResource(NS_RDF + "Seq");
    var property, items, item, index;
    var childrenArr = [];

    while(children.hasMoreElements()) {
      property = children.getNext();
      if(!rdfContainerUtils.IsOrdinalProperty(property))
         continue;
      index = rdfContainerUtils.OrdinalResourceToIndex(property);

      items = gSEOrganizer.GetTargets(node, property, true);
      while(items.hasMoreElements()) {
        item = items.getNext();
        if(!(item instanceof Ci.nsIRDFResource))
          continue;

        if(gRemovedEngines.some(function(e) item.EqualsString(e.node.ValueUTF8)))
          continue;

        if(gSEOrganizer.HasAssertion(item, instanceOf, seq, true))
          childrenArr.push({idx: index, child: new Structure__Container(this, item)});
        else
          childrenArr.push({idx: index, child: new Structure__Item(this, item)});
      }
    }
    childrenArr.sort(function(a, b) a.idx - b.idx)
               .forEach(function(e) this.push(e.child), this);
  }
  this.modified = 0;
}
Structure__Container.prototype = {
  node: null, nodeID: "",
  parent: null,
  _name: "",
  get name() { return this._name; },
  set name(name) { this.modified = this.modified || 1; return this._name = name },
  children: null,
  open: false,
  isSep: false,
  isSeq: true,
  isEngine: false,
  iconURI: "",
  alias: "",
  modified: 0,
  originalEngine: null,
  inheritFrom: function(old) {
    this.modified = old.modified || 1;
    this.name = old.name;
  }
};
function Structure__Item(parent, node, engine) {
  this.parent = parent;
  this.node = node;
  this.nodeID = node.ValueUTF8;
  this.modified = engine ? 1 : 0;
  if(!engine || !(engine instanceof Ci.nsISearchEngine))
    engine = null;

  var rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                     .getService(Ci.nsIRDFService);

  var namePred = rdfService.GetResource(NS + "Name");
  var name = gSEOrganizer.GetTarget(node, namePred, true);
  if(name instanceof Ci.nsIRDFLiteral && name.Value)
    this._name = name.Value;
  else if(engine)
    this.name = engine.name;


  var type = rdfService.GetResource(NS_RDF + "type");
  var separator = rdfService.GetResource(NS + "separator");
  this.isSep = gSEOrganizer.HasAssertion(node, type, separator, true);

  if(!engine && !this.isSeq)
    engine = gSEOrganizer.getEngineByName(this.name);

  this.originalEngine = engine;
  if(engine) {
    this.alias = engine.alias;
    this.iconURI = (engine.iconURI || {spec: ""}).spec;
  }
}
Structure__Item.prototype = {
  node: null, nodeID: "",
  parent: null,
  _name: "",
  get name() { return this._name; },
  set name(name) { this.modified = this.modified || 1; return this._name = name },
  iconURI: "",
  isSep: false,
  isSeq: false,
  get isEngine() {
    return !this.isSep;
  },
  recursiveChildCount: 0,
  originalEngine: null,
  alias: "",
  commit: function Structure__Item__commit() {
    if(this.modified == 2) {
      var rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                         .getService(Ci.nsIRDFService);
      if(this.isSep) {
        var type = rdfService.GetResource(NS_RDF + "type");
        var separator = rdfService.GetResource(NS + "separator");
        gSEOrganizer.Assert(this.node, type, separator, true);
      } else {
        var namePred = rdfService.GetResource(NS + "Name");
        gSEOrganizer.Assert(this.node, namePred, rdfService.GetLiteral(this.name), true);
        this.originalEngine.hidden = false;
      }
    }
    if(this.modified && this.originalEngine) {
      var engine = this.originalEngine.wrappedJSObject;
      var changed = false;
      if(engine.__updateToEngine) { // properties were changed
        var replace = engine.__updateToEngine.wrappedJSObject;
        for(var property in replace) {
          if(!(replace.__lookupGetter__(property) || replace.__lookupSetter__(property)) &&
             replace.hasOwnProperty(property) && property != "__updateToEngine")
            engine[property] = replace[property];
        }
        delete engine.__updateToEngine;
        if(this.iconURI != engine._iconURI.spec)
          engine._setIcon(this.iconURI, true);

        var globalObject = engine.__parent__;
        globalObject.engineMetadataService.setAttr(engine, "updatedatatype", engine._dataType.toString());
        if(engine._hasUpdates && !globalObject.engineMetadataService.getAttr(engine, "updateexpir"))
          globalObject.engineUpdateService.scheduleNextUpdate(engine);

        engine.__action = "properties";
        changed = true;
      }
      if(engine.alias != this.alias)
        engine.alias = this.alias;
      if(engine.name != this.name) {
        var oldName = engine.name;

        var realSearchService = gSEOrganizer._searchService.wrappedJSObject;
        delete realSearchService._engines[oldName];
        realSearchService._engines[this.name] = engine;
        engine._name = this.name;
        if(!engine.__action)
          engine.__action = "name";
        changed = true;
      }
      if(gSEOrganizer.getNameByItem(this.node) != this.name) {
        var rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                           .getService(Ci.nsIRDFService);
        var namePred = rdfService.GetResource(NS + "Name");
        oldName = gSEOrganizer.GetTarget(this.node, namePred, true);
        try {
          if(oldName instanceof Ci.nsIRDFNode)
            gSEOrganizer.Unassert(this.node, namePred, oldName);
        } catch(e) {}
        gSEOrganizer.Assert(this.node, namePred,
                            rdfService.GetLiteral(this.name), true);
      }
      if(changed) {
        if(!engine._readOnly)
          engine._lazySerializeToFile();
        // inform everybody of the changes, also stores our changes in the cache
        Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService)
          .notifyObservers(engine, SEARCH_ENGINE_TOPIC, "engine-changed");
      }
    }
  },
  inheritFrom: function(old) {
    this.alias = old.alias;
    Structure__Container.prototype.inheritFrom.apply(this, arguments);
  }
};
Structure__Item.prototype.isAncestorOf =
Structure__Container.prototype.isAncestorOf =
           function Structure__General__isAncestorOf(item) {
  return this.parent === item || this.parent.isAncestorOf(item);
};
Structure__Item.prototype.destroy = Structure__Container.prototype.destroy =
           function Structure__General__destroy() {
  var idx = this.parent.children.indexOf(this);
  this.parent.children = this.parent.children.slice(0, idx)
                             .concat(this.parent.children.slice(idx + 1));
  this.parent.modified = this.parent.modified || 1;
  this.node = this.parent = this.children = null;
};
Structure__Container.prototype.push = Structure.prototype.push =
           function Structure__General__push(what) {
  this.modified = this.modified || 1;
  this.children.push.apply(this.children, arguments);
};
Structure__Container.prototype.insertAt = Structure.prototype.insertAt =
           function Structure__General__insertAt(idx, item) {
  this.modified = this.modified || 1;
  item.parent = this;
  if(idx == -1 || idx >= this.children.length) {
    this.children.push(item);
  } else if(idx == 0) {
    this.children = [item].concat(this.children);
  } else {
    var children = this.children.slice(0, idx);
    children.push(item);
    this.children = children.concat(this.children.slice(idx));
  }
  return item;
};
Structure__Container.prototype.commit = Structure.prototype.commit =
           function Structure__General__commit() {
  for(var i = 0; i < this.children.length; ++i) {
    this.children[i].commit();
  }
  if(this.modified) {
    var rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                       .getService(Ci.nsIRDFService);
    if(this instanceof Structure__Container && (this.modified == 2 ||
       this.name != gSEOrganizer.getNameByItem(this.node))) {
      var namePred = rdfService.GetResource(NS + "Name");
      var oldName = gSEOrganizer.GetTarget(this.node, namePred, true);
      var name = rdfService.GetLiteral(this.name);
      if(oldName instanceof Ci.nsIRDFLiteral)
        gSEOrganizer.Unassert(this.node, namePred, oldName);
      gSEOrganizer.Assert(this.node, namePred, name, true);
    }

    var rdfContainerUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                              .getService(Ci.nsIRDFContainerUtils);
    var container = rdfContainerUtils.MakeSeq(gSEOrganizer, this.node);
    var oldCount = container.GetCount();
    for(var i = 0; i < this.children.length; ++i) {
      container.AppendElement(this.children[i].node);
    }
    for(var i = oldCount; i !== 0; --i) {
      var pred = rdfService.GetResource(NS_RDF + "_" + i);
      if(gSEOrganizer.hasArcOut(container.Resource, pred)) {
        try {
          container.RemoveElementAt(i, !(i - 1));
        } catch(e) { }
      }
    }
  }
};
Structure__Container.prototype.find = Structure.prototype.find =
           function Structure__General__find(property, value, besides) {
  for(var i = 0, tmp; i < this.children.length; i++) {
    if(this.children[i] != besides && property in this.children[i] &&
       this.children[i][property] == value)
      return this.children[i];
    if(this.children[i].isSeq) {
      tmp = this.children[i].find(property, value, besides);
      if(tmp)
        return tmp;
    }
  }
  return null;
};
(function() { // anonymous function so we don't pollute the global namespace
  function recursiveChildCount() {
    var count = this.children.length - 1;
    for(var i = this.children.length; i--;) {
      if(this.children[i].isSeq && this.children[i].open)
        count += this.children[i].recursiveChildCount + 1;
    }
    return count;
  }
  Structure.prototype.__defineGetter__("recursiveChildCount",
                                       recursiveChildCount);
  Structure__Container.prototype.__defineGetter__("recursiveChildCount",
                                                  recursiveChildCount);
})();

function EngineView(aStructure) {
  this._structure = aStructure;
  this.updateCache();
}
EngineView.prototype = {
  _structure: null,
  _indexCache: [],
  updateCache: function EngineView__updateCache() {
    var cache = [];
    var folds = [new TempObj(this._structure, 0)], lastIndex;
    while(folds.length) {
      lastIndex = folds.length - 1;
      for(var i = folds[lastIndex].i; i < folds[lastIndex].c.length; ++i) {
        cache.push(folds[lastIndex].c[i]);
        try {
          if(folds[lastIndex].c[i].isSeq && folds[lastIndex].c[i].open) {
            folds[lastIndex].i = i + 1;
            folds.push(new TempObj(folds[lastIndex++].c[i], i = -1));
          }
        } catch(e) {
        }
      }
      folds = folds.slice(0, lastIndex);
    }
    this._indexCache = cache;
    this._indexCache.__defineGetter__(-1, function() {
      return gEngineView._structure;
    });

    function TempObj(s, i) {
      this.s = s;
      this.i = i;
      if((gSortDir == "ascending" || gSortDir == "descending")) {
        this.c = gResort(s.children);
      } else
        this.c = s.children;
    }
  },

  /* helpers */
  tree: null,
  get lastIndex() {
    return this.rowCount - 1;
  },
  get selectedIndex() {
    return this.selection.currentIndex;
  },
  get selectedIndexes() {
    var seln = this.selection;
    var indexes = [];
    for(var i = 0; i < this.rowCount; i++) {
      if(seln.isSelected(i))
        indexes.push(i);
    }
    return indexes.reverse();
  },
  get selectedItem() {
    return this._indexCache[this.selectedIndex];
  },
  get selectedItems() {
    var items = [], indexes = this.selectedIndexes;
    for(var i = 0; i < indexes.length; ++i) {
      items.push(this._indexCache[indexes[i]]);
    }
    return items;
  },
  get selectedEngine() {
    return this._indexCache[this.selectedIndex].originalEngine;
  },
  get selectedEngines() {
    var engines = [], indexes = this.selectedIndexes;
    for(var i = 0; i < indexes.length; ++i) {
      engines.push(this._indexCache[indexes[i]].originalEngine);
    }
    return engines;
  },
  select: function EngineView__select(/*index0, index1, ...,  override*/) {
    var seln = gEngineView.selection;
    var override = arguments[arguments.length - 1];
    if(override)
      seln.clearSelection();

    for(var i = 0; i < arguments.length - 1; ++i) {
      if(arguments[i] < 0 || arguments[i] > this.rowCount) continue;
      if(!seln.isSelected(arguments[i]))
        seln.toggleSelect(arguments[i]);
      this.ensureRowIsVisible(arguments[i]);
    }
  },
  invalidate: function EngineView__invalidate() {
    this.updateCache();
    return this.tree.invalidate();
  },
  invalidateRow: function(row) {
    return this.tree.invalidateRow(row);
  },
  invalidateCell: function(row, colId) {
    return this.tree.invalidateCell(row, this.getNamedColumn(colId));
  },
  rowCountChanged: function EngineView__rowCountChanged(index, count) {
    return this.tree.rowCountChanged(index, count);
  },
  ensureRowIsVisible: function (index) {
    this.tree.ensureRowIsVisible(index);
  },
  getNamedColumn: function EngineView__getNamedColumn(name) {
    return this.tree.columns.getNamedColumn(name)
  },
  commit: function commit() {
    gSEOrganizer.beginUpdateBatch();
    for(var i = 0; i < gSEOrganizer._observers.length; ++i) {
      gSEOrganizer._datasource.RemoveObserver(gSEOrganizer._observers[i]);
    }
    this._structure.commit();
    gRemovedEngines.forEach(function(removedItem) {
      // remove the search engine, the rest is done by our observers
      if(removedItem.engine && removedItem.engine instanceof Ci.nsISearchEngine)
        gSEOrganizer.removeEngine(removedItem.engine);
      else if(removedItem.node && removedItem.node instanceof Ci.nsIRDFResource)
        gSEOrganizer.removeItem(removedItem.node, false);
    });
    for(var i = 0; i < gSEOrganizer._observers.length; ++i) {
      gSEOrganizer._datasource.AddObserver(gSEOrganizer._observers[i]);
    }
    gSEOrganizer.endUpdateBatch();
    gSEOrganizer.saveChanges();
  },

  engineVisible: function engineVisible(engine) {
    return !!this._structure.find("originalEngine", engine);
  },
  getLocalIndex: function getLocalIndex(idx) {
    return this._indexCache[idx].parent.children.indexOf(this._indexCache[idx]);
  },
  _lastSourceItems: null,
  getSourceItemsFromDrag: function getSourceItemsFromDrag() {
    var dragService = Cc["@mozilla.org/widget/dragservice;1"]
                        .getService().QueryInterface(Ci.nsIDragService);
    var dragSession = dragService.getCurrentSession();
    var transfer = Cc["@mozilla.org/widget/transferable;1"]
                     .createInstance(Ci.nsITransferable);

    transfer.addDataFlavor(ENGINE_FLAVOR);
    dragSession.getData(transfer, 0);

    var dataObj = {};
    var len = {};
    var sourceItems = [];
    try {
      transfer.getAnyTransferData({}, dataObj, len);
    } catch (ex) {}

    if (dataObj.value) {
      sourceItems = dataObj.value.QueryInterface(Ci.nsISupportsString).data;
      sourceItems = sourceItems.substring(0, len.value);
      this._lastSourceItems = sourceItems;
      sourceItems = window._dragData[sourceItems];
    }

    return sourceItems;
  },
  clearSourceIndexes: function() {
    if(_dragData[this._lastSourceItems])
      delete _dragData[this._lastSourceItems];
  },

  get _engineStore() {
    return new EngineStore();
  },

  /* nsITreeView */
  get rowCount() {
    return this._indexCache.length;
  },
  selection: null,
  canDrop: function EngineView__canDrop(index, orientation) {
    var sourceItems = this.getSourceItemsFromDrag();
    if(!sourceItems.length)
      return false;
    for(var i = 0; i < sourceItems.length; i++) {
      var sourceItem = sourceItems[i];
      var sourceIndex = this._indexCache.indexOf(sourceItem);
      var dropItem = this._indexCache[index];

      var dropOnNext = (sourceIndex !== index + orientation ||
                        sourceItem.parent !== dropItem.parent);
      var dropOnSame = sourceIndex !== index;
      if(gSortDir == "ascending" || gSortDir == "descending") {
        var sameParent = (dropItem.parent != sourceItem.parent) ||
                         (sourceItem.isSep) || (orientation == 0) ||
                         (orientation == 1 && dropItem.isSep && dropItem.open);
        if(!(dropOnNext && dropOnSame && sameParent))
          return false;
      } else {
        var isAncestor = !dropItem.isAncestorOf(sourceItem);
        if(!(dropOnNext && dropOnSame && isAncestor))
          return false;
      }
    }
    return true;
  },
  cycleCell: function() {},
  cycleHeader: function(col) {
    if(col.id != "engineName")
      return;
    col = col.element || document.getElementById(col.id);
    var cycle = {
      "natural":    "ascending",
      "ascending":  "descending",
      "descending": "natural"
    };

    gEngineManagerDialog.sortBy(cycle[col.getAttribute("sortDirection")]);
  },
  drop: function EngineView__drop(treeDropIndex, orientation) {
    // find out the indexes
    var treeSourceItems = this.getSourceItemsFromDrag(), treeSourceIndexes = [];
    for(var i = 0; i < treeSourceItems.length; i++) {
      treeSourceIndexes.push(this._indexCache.indexOf(treeSourceItems[i]));
    }
    this.clearSourceIndexes();
    var treeParentIndex = this.getParentIndex(treeDropIndex);
    var dropIndex;

    switch(orientation) {
      case Ci.nsITreeView.DROP_ON:
        treeParentIndex = treeDropIndex;
        dropIndex = this._indexCache[treeParentIndex].children.length;
        break;
      case Ci.nsITreeView.DROP_BEFORE:
        var dropParent = this._indexCache[treeDropIndex].parent;
        dropIndex = this.getLocalIndex(treeDropIndex);
        break;
      case Ci.nsITreeView.DROP_AFTER:
        var dropItem = this._indexCache[treeDropIndex];
        if(dropItem.isSeq && dropItem.open) {
          treeParentIndex = treeDropIndex;
          dropIndex = 0;
        } else {
          var dropParent = this._indexCache[treeDropIndex].parent;
          dropIndex = this.getLocalIndex(treeDropIndex);
        }
        break;
      default:
        return;
    }

    // now that we have the indexes, do the moving
    var parent = this._indexCache[treeParentIndex];
    if(!parent || !parent.children)
      return;
    var items = [], tempDropIndex, relative = 0;
    for(var i = 0; i < treeSourceIndexes.length; i++) {
      var item = treeSourceItems[i];
      tempDropIndex = dropIndex + relative;
      if(treeDropIndex > treeSourceIndexes[i] && dropParent == item.parent)
        relative -= 1;
      if(tempDropIndex) {
        if(orientation == Ci.nsITreeView.DROP_BEFORE &&
           (treeDropIndex > treeSourceIndexes[i] && dropParent == item.parent)) {
          tempDropIndex -= 1;
        } else if(orientation == Ci.nsITreeView.DROP_AFTER &&
                  (treeDropIndex < treeSourceIndexes[i] || dropParent != item.parent)) {
            tempDropIndex += 1;
        }
      }
      items[i] = this.internalMove(item, parent, tempDropIndex);
      this.rowCountChanged(treeSourceIndexes[i], -1);
    }
    item = items[0];

    // update the tree and correct the selection
    this.select(true); // clear selection
    this.updateCache();
    for(var i = 0; i < items.length; i++) {
      this.rowCountChanged(this._indexCache.indexOf(items[i]), 1);
    }
    for(var i = 0; i < items.length; i++) {
      this.select(this._indexCache.indexOf(items[i]), false);
    }
    document.getElementById("engineList").focus();
  },
  internalMove: function(old, parent, index) {
    if(!old || !parent) {
      Components.reportError(new Error('an unknown error occured'));
      return false;
    }

    // open all parent containers:
    for(var p = parent, last = {}; p != gEngineView._structure; p = p.parent) {
      if(!p.open) {
        last.open = true;
        last = p;
      }
    }
    gEngineView.toggleOpenState(gEngineView._indexCache.indexOf(last));

    var treeParentIndex = this._indexCache.indexOf(parent);
    var node = old.node, children = old.children;
    old.destroy();
    if(old.isSeq) {
      var item = new Structure__Container(parent, node, children, old.open);
    } else {
      var item = new Structure__Item(parent, node, old.originalEngine);
    }
    item.inheritFrom(old);
    parent.insertAt(index, item);
    return item;
  },
  getCellProperties: function EngineView__getCellProperties(row, col, props) {
    var aserv = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
    if(this.isSeparator(row))
      props.AppendElement(aserv.getAtom("separator"));
    if(col.id == "engineName") {
      props.AppendElement(aserv.getAtom("Name"));
      props.AppendElement(aserv.getAtom("title"));
    }
    if(this.isContainer(row) && this.isContainerOpen(row))
      props.AppendElement(aserv.getAtom("open"));
  },
  getCellText: function EngineView__getCellText(row, col) {
    var rowItem = this._indexCache[row];
    if(col.id == "engineName")
      return rowItem.isSep ? "" : rowItem.name.replace(/\s+$/, "");
    else if(col.id == "engineAlias")
      return rowItem.isSep ? "" : rowItem.alias;
    return "";
  },
  getCellValue: function EngineView__getCellValue(row, col) { },
  getColumnProperties: function EngineView__getColumnProperties(col, props) {
    var aserv = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
    props.AppendElement(aserv.getAtom(col.id));
    if(col.id == "engineName") {
      props.AppendElement(aserv.getAtom("Name"));
      props.AppendElement(aserv.getAtom("title"));
    }
  },
  getImageSrc: function EngineView__getImageSrc(row, col) {
    if(col.id == "engineName")
      return this._indexCache[row].iconURI;
    return "";
  },
  getLevel: function EngineView__getLevel(index) {
    var item = this._indexCache[index];
    if(!item) return -1;

    var level = -1;
    while((item = item.parent))
      ++level;
    return level;
  },
  getParentIndex: function EngineView__getParentIndex(index) {
    return this._indexCache.indexOf(this._indexCache[index].parent);
  },
  getProgressMode: function() { return 0; },
  getRowProperties: function EngineView__getRowProperties(index, properties) {
    var aserv = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
    if(this.isSeparator(index))
      properties.AppendElement(aserv.getAtom("separator"));
  },
  hasNextSibling: function EngineView__hasNextSibling(rowIndex, afterIndex) {
    var row = this._indexCache[rowIndex];
    var parent = row.parent;
    var siblings = parent.children;
    var internalRowIndex = siblings.indexOf(row)
    if(internalRowIndex + 1 == siblings.length)
      return false;
    else if(rowIndex == afterIndex) {
      return true;
    }

    var parentIndex = this._indexCache.indexOf(parent);
    var last = parentIndex + parent.recursiveChildCount + 1;
    for(var i = afterIndex + 1; i <= last; ++i) {
      if(this._indexCache[i].parent == parent)
        return true;
    }
    return false;
  },
  isContainer: function EngineView__isContainer(index) {
    return this._indexCache[index].isSeq;
  },
  isContainerEmpty: function EngineView__isContainerEmpty(index) {
    if(!this.isContainer(index))
      return true;
    return this._indexCache[index].children.length === 0;
  },
  isContainerOpen: function EngineView__isContainerOpen(index) {
    if(!this.isContainer(index))
      return false;
    return this._indexCache[index].open;
  },
  isEditable: function EngineView__isEditable(row, col) {
    var item = this._indexCache[row];
    var engine = item.originalEngine ? item.originalEngine.wrappedJSObject : null;
    var editableEngine = engine && (!engine._readOnly || "_serializeToJSON" in engine);
    return (col.id == "engineName" && (item.isSeq || editableEngine)) ||
           (col.id == "engineAlias" && item.isEngine);
  },
  isSeparator: function EngineView__isSeparator(index) {
    return this._indexCache[index].isSep;
  },
  isSorted: function EngineView__isSorted() {
    return gSortDir == "descending" || gSortDir == "ascending";
  },
  performAction: function() {},
  performActionOnCell: function() {},
  performActionOnRow: function() {},
  selectionChanged: function() {},
  setCellText: function EngineView__setCellText(row, col, value) {
    var item = this._indexCache[row];
    if(!item) return;
    if(col.id == "engineName") {
      if(item.name == value) return;
      while(gEngineView._structure.find("name", value, item)) {
        value = value + " ";
      }
      item.name = value;
      gEngineView.invalidateCell(row, "engineName");
    } else if(col.id == "engineAlias") {
      value = value.replace(/ /g, "").toLowerCase();
      if(item.alias == value) return;

      var other = gEngineView._structure.find("alias", value, item);
      while(value && other) {
        gEngineView.setCellText(gEngineView._indexCache.indexOf(other), col, "");
        other = gEngineView._structure.find("alias", value, item);
      }
      gSEOrganizer.getEngines({}).forEach(function(engine) {
        if(!gEngineView.engineVisible(engine) && engine.alias == value)
          engine.alias = "";
      });

      item.alias = value;
      item.modified = item.modified || 1;

      gEngineView.invalidateCell(row, "engineAlias");
    }
  },
  setCellValue: function() {},
  setTree: function(tree) {
    this.tree = tree;
  },
  toggleOpenState: function(index) {
    var item = this._indexCache[index];
    if(index == -1 || !item) return false;
    var count = item.recursiveChildCount + 1;
    var open = (item.open = !item.open);
    this.updateCache();
    this.rowCountChanged(index + 1, (open ? 1 : -1) * count);
    this.invalidateCell(index, "engineName");
    this.ensureRowIsVisible(index + 1 + (open ? 1 : 0) * count);
    this.ensureRowIsVisible(index);
    return open;
  }
};
function LOG(msg) {
  msg = "Organize Search Engines:   " + msg;
  var consoleService = Cc["@mozilla.org/consoleservice;1"]
                         .getService(Ci.nsIConsoleService);
  consoleService.logStringMessage(msg);
  //dump(msg + "\n");
  return msg;
}

var gConstructedColumnsMenuItems = false;
function fillColumnsMenu(aEvent) {
  var bookmarksView = document.getElementById("engineList");
  var columns = bookmarksView.firstChild.childNodes;
  var i;

  if (!gConstructedColumnsMenuItems) {
    for (i = 0; i < columns.length; ++i) {
      if(columns[i].nodeName != "treecol")
        continue;
      var menuitem = document.createElement("menuitem");
      if(columns[i].getAttribute("primary") == "true")
        menuitem.setAttribute("disabled", "true");
      menuitem.setAttribute("label", columns[i].getAttribute("label"));
      menuitem.setAttribute("resource", columns[i].resource);
      menuitem.setAttribute("id", "columnMenuItem_" + columns[i].resource);
      menuitem.setAttribute("type", "checkbox");
      menuitem.setAttribute("checked", (!columns[i].hidden));
      menuitem.colIndex = i;
      aEvent.target.appendChild(menuitem);
    }

    gConstructedColumnsMenuItems = true;
  }
  else {
    for (i = 0; i < columns.length; ++i) {
      if(columns[i].nodeName != "treecol")
        continue;
      var element = document.getElementById("columnMenuItem_" + columns[i].resource);
      if (element) {
        if(columns[i].hidden != "true")
          element.setAttribute("checked", "true");
        else
          element.removeAttribute("checked");
      }
      element.colIndex = i;
    }
  }
  
  aEvent.stopPropagation();
}
function onViewMenuColumnItemSelected(aEvent) {
  var bookmarksView = document.getElementById("engineList");
  var elem = bookmarksView.firstChild.childNodes[aEvent.target.colIndex];
  elem.hidden = !elem.hidden;

  aEvent.stopPropagation();
}


/* attempt to be somewhat compatible to the original code */
function EngineStore() {
  this.engines = [];
  for(var i = 0; i < gEngineView._indexCache.length; i++) {
    this.engines.push(gEngineView._indexCache[i].originalEngine);
  }
  this.engines.length = gEngineView._indexCache.length;
  // copy the _dragData stuff over to here so that exts retrieving the "index"
  for(var i in window._dragData) { // from the drag can use it here
    if(window._dragData[i].length)
      this.engines[i] = window._dragData[i][0].originalEngine;
    else
      this.engines[i] = null;
  }
}
EngineStore.prototype = {
  engines: null, // array
  _getEngineByName: function(name) {
    var engine = gSEOrganizer.getEngineByName(name);
    if(engine && gEngineView.engineVisible(engine))
      return engine;
    return null;
  }
};