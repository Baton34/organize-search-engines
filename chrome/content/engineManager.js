try {

const Ci = Components.interfaces, Cc = Components.classes;

const ENGINE_FLAVOR = "text/x-moz-search-engine";
const FLAVOR_SEPARATOR = ";";
const BROWSER_SUGGEST_PREF = "browser.search.suggest.enabled";
const SORT_DIRECTION_PREF = "extensions.seorganizer.sortDirection";


const SEARCH_ENGINE_TOPIC        = "browser-search-engine-modified";

const NS = "urn:organize-search-engines#";
const NS_RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const ROOT = "urn:organize-search-engines:root";

var gEngineManagerDialog, gDragObserver, gEngineView, gStrings;
var gRemovedEngines = [], gAddedEngines = [], gSortDir = "natural";

const CONTRACT_ID =
         "@mozilla.org/rdf/datasource;1?name=organized-internet-search-engines";
var gSEOrganizer = Cc[CONTRACT_ID].getService(Ci.nsISEOrganizer).wrappedJSObject;

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


function EngineManagerDialog() {
}
EngineManagerDialog.prototype = {
  init: function EngineManager__init() {
    gStrings = document.getElementById("strings");

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
    gEngineView = new EngineView(new Structure());
    engineList.view = gEngineView;

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

    document.getElementById("engineList").focus();
  },
  onOK: function EngineManager__onOK() {
    // Set the preference
    var newSuggestEnabled = document.getElementById("enableSuggest")
                                    .getAttribute("checked");
    newSuggestEnabled = (newSuggestEnabled == "true") ? true : false;
    var prefService = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefBranch);
    prefService.setBoolPref(BROWSER_SUGGEST_PREF, newSuggestEnabled);
    var str = Cc["@mozilla.org/supports-string;1"]
                .createInstance(Ci.nsISupportsString);
    str.data = gSortDir;
    prefService.setComplexValue(SORT_DIRECTION_PREF, Ci.nsISupportsString, str);

    // Commit the changes
    gEngineView.commit();

    this.onClose();
  },
  onCancel: function EngineManager__onCancel() {
    gSEOrganizer.reload();
    gSEOrganizer.beginUpdateBatch();
    var rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                       .getService(Ci.nsIRDFService);
    var rdfContainerUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                              .getService(Ci.nsIRDFContainerUtils);
    var container, parent;
    for(var i = 0; i < gAddedEngines.length; ++i) {
      parent = gSEOrganizer.getParent(gAddedEngines[i]);
      container = rdfContainerUtils.MakeSeq(gSEOrganizer, parent);
      container.RemoveElement(gAddedEngines[i], true);
    }
    gSEOrganizer.saveChanges();
    gSEOrganizer.endUpdateBatch();
    this.onClose();
  },
  onClose: function EngineManager__onClose() {
    // Remove the observers
    var os = Cc["@mozilla.org/observer-service;1"].
             getService(Ci.nsIObserverService);
    os.removeObserver(this, "browser-search-engine-modified");

    var branch = Cc["@mozilla.org/preferences-service;1"]
                   .getService(Ci.nsIPrefService).getBranch("");
    branch.QueryInterface(Ci.nsIPrefBranch2);
    branch.removeObserver("", this);

    // notify observers
    os.notifyObservers(null, "browser-search-engine-modified",
                       "-engines-organized");
  },

  observe: function EngineManager__observe(aSubject, aTopic, aVerb) {
    window.setTimeout(function() {
      if(aTopic === "browser-search-engine-modified") {
        var aEngine = aSubject.QueryInterface(Ci.nsISearchEngine)
        switch (aVerb) {
          case "engine-added":
            gEngineView.addEngine(aEngine);
            gEngineView.rowCountChanged(gEngineView.lastIndex, 1);
            break;
          case "engine-changed":
            break;
          case "engine-removed":
            gEngineView.rowCountChanged(null, -1);
            break;
          case "engine-current":
            return; // Not relevant
        }
        gEngineView.invalidate();
      } else if(aTopic === "nsPref:changed") {
        var prefService = aSubject.QueryInterface(Ci.nsIPrefBranch);
        switch(aVerb) {
          case BROWSER_SUGGEST_PREF:
            var value = prefService.getBoolPref(BROWSER_SUGGEST_PREF);
            document.getElementById("enableSuggest").setAttribute("checked", value);
            break;
          case SORT_DIRECTION_PREF:
            this.sortBy(prefService.getComplexValue(SORT_DIRECTION_PREF,
                                                   Ci.nsISupportsString));
            break;
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
    // we want the indexes in reversed order as we're changing indexes...
    var indexes = gEngineView.selectedIndexes.sort(compareNumbers).reverse();
    var index, item, parent, localIndex;
    gEngineView.selection.clearSelection();

    for(var k = 0; k < indexes.length; k++) {
      index = indexes[k];
      item = gEngineView._indexCache[index];
      parent = item.parent;
      localIndex = parent.children.indexOf(item);

      gRemovedEngines.push(item.node);
      var removedCount = 1;
      if(item.isSeq) {
        var items = [item.children];
        for(var i = 0; i < items.length; ++i) {
          for(var j = 0; j < items[i].length; ++j) {
            gRemovedEngines.push(items[i][j].node);
            ++removedCount;
            if(items[i][j].isSeq)
              items.push(items[i][j].children);
          }
        }
      }

      parent.children = parent.children.slice(0, localIndex)
                              .concat(parent.children.slice(localIndex + 1));

      gEngineView.updateCache();
      gEngineView.rowCountChanged(index, -removedCount);
      gEngineView.invalidate();
      var idx = Math.min(index, gEngineView.lastIndex);
      gEngineView.ensureRowIsVisible(idx);
    }

    document.getElementById("engineList").focus();

    this.showRestoreDefaults();
  },
  bump: function EngineManager__bump(direction) {
    var indexes = gEngineView.selectedIndexes.sort(compareNumbers);
    var index, item, localIndex, newLocalIndex, children, newChildren, newIndex;
    gEngineView.selection.clearSelection();
    if(direction == -1)
      indexes.reverse();

    for(var i = 0; i < indexes.length; i++) {
      index = indexes[i];
      item = gEngineView._indexCache[index];

      localIndex = gEngineView.getLocalIndex(index);
      newLocalIndex = localIndex - direction;
      children = item.parent.children;
      newChildren = children.slice(0, Math.min(newLocalIndex, localIndex));
      newChildren.push(children[Math.max(newLocalIndex, localIndex)]);
      newChildren.push(children[Math.min(newLocalIndex, localIndex)]);
      newChildren = newChildren.concat(children.slice(Math.max(newLocalIndex,
                                                               localIndex) + 1));
      item.parent.children = newChildren;
      item.parent.modified = true;

      gEngineView.updateCache();
      // as there are folders, the new index could be virtually anywhere:
      newIndex = gEngineView._indexCache.indexOf(item);
      gEngineView.rowCountChanged(index, -1);
      gEngineView.rowCountChanged(newIndex, 1);
      gEngineView.ensureRowIsVisible(newIndex);
      gEngineView.selection.rangedSelect(newIndex, newIndex, true);
    }
    document.getElementById("engineList").focus();
  },
  move: function EngineManager__move() {
    var canceled = {value: true}, returnVal = {};
    window.openDialog("chrome://seorganizer/content/moveTo.xul", "_blank",
                      "resizable,chrome,modal,dialog", canceled, returnVal);
    if(canceled.value)
      return;
    var target;
    if(returnVal.value == ROOT)
      target = gEngineView._structure;
    else
      target = gEngineView._structure.find(returnVal.value);
    if(!target)
      return;

    var selected = gEngineView.selectedItems;
    var item, itemIndex, node, children;
    var n = 0;
    for(var i = 0; i < selected.length; i++) {
      if(selected[i].parent != target) {
        selected[i] = gEngineView.internalMove(selected[i], target, -1);
      }
    }

    gEngineView.updateCache();
    gEngineView.invalidate();
    gEngineView.selection.clearSelection();
    var indexes = [];
    for each(var item in selected) {
      if(item)
        indexes.push(gEngineView._indexCache.indexOf(item));
    }
    gEngineView.select.apply(gEngineView, indexes.concat([true]));
    document.getElementById("engineList").focus();
  },
  editAlias: function EngineManager__editAlias() {
    document.getElementById("engineList").focus();
    var index = gEngineView.selectedIndex;
    var item = gEngineView.selectedItem;

    var alias = { value: item.alias };
    var name =  { value: item.name  };
    var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                    .getService(Ci.nsIPromptService);
    var title = gStrings.getFormattedString("editalias.title", [name.value]);
    var content = gStrings.getFormattedString("editalias.name", [name.value]);
    var abort = prompts.prompt(window, title, content, alias, null, {});
    if(!abort)
      return;

    item.alias = alias.value.toLowerCase();

    gEngineView.rowCountChanged(index, -1);
    gEngineView.rowCountChanged(index, 1);
    gEngineView.selection.clearSelection();
    gEngineView.selection.select(index);
    gEngineView.ensureRowIsVisible(index);
  },
  editName: function EngineManager__editName() {
    document.getElementById("engineList").focus();
    var index = gEngineView.selectedIndex;
    var item = gEngineView.selectedItem;

    var name = { value: item.name };
    var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                    .getService(Ci.nsIPromptService);
    var title = gStrings.getFormattedString("rename.title", [name.value]);
    var content = gStrings.getFormattedString("rename.name", [name.value]);
    var abort = prompts.prompt(window, title, content, name, null, {});
    if(!abort)
      return;

    item.name = name.value;

    gEngineView.rowCountChanged(index, -1);
    gEngineView.rowCountChanged(index, 1);
    gEngineView.selection.clearSelection();
    gEngineView.selection.select(index);
    gEngineView.ensureRowIsVisible(index);
    document.getElementById("engineList").focus();
  },

  get NEW_ITEM_TYPE_SEPARATOR() {
    return "separator";
  },
  get NEW_ITEM_TYPE_FOLDER() {
    return "folder";
  },
  get NEW_ITEM_RESTORED_DEFAULT_ENGINE() {
    return "default-engine";
  },
  newItem: function EngineManager__newItem(type) {
    var treeInsertLoc = gEngineView.selectedIndex;
    var insertLoc, parent;
    if(treeInsertLoc === -1) {
      insertLoc = -1;
      parent = gEngineView._indexCache[-1];
    } else if(gEngineView._indexCache[treeInsertLoc].isSeq &&
              gEngineView._indexCache[treeInsertLoc].open) {
      parent = gEngineView._indexCache[treeInsertLoc];
      insertLoc = -1;
    } else {
      parent = gEngineView._indexCache[treeInsertLoc].parent;
      insertLoc = gEngineView.getLocalIndex(treeInsertLoc) + 1;
    }

    var node, item;
    switch(type) {
      case this.NEW_ITEM_TYPE_SEPARATOR:
        node = gSEOrganizer.newSeparator(parent.node);
        item = new Structure__Item(parent, node);
        break;
      case this.NEW_ITEM_TYPE_FOLDER:
        var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Ci.nsIPromptService);
        var name = { value: "" };
        var abort = prompts.prompt(window,
                                   gStrings.getString("new-folder.title"),
                                   gStrings.getString("new-folder.name"), name,
                                   null, {});
        if(!abort)
          return;

        var node = gSEOrganizer.newFolder(name.value, parent.node);
        item = new Structure__Container(parent, node);
        break;
      case this.NEW_ITEM_RESTORED_DEFAULT_ENGINE:
        var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Ci.nsIPromptService);
        var defaults = gSEOrganizer.getDefaultEngines({}).filter(function(e) {
          return !gEngineView.engineVisible(e);
        });
        if(!defaults.length)
          return;
        var defaultNames = [];
        for(var i = 0; i < defaults.length; ++i) {
          defaultNames[i] = defaults[i].name;
        }
        var selection = {};
        var cancel = prompts.select(window, gStrings.getString("restore.title"),
                                    gStrings.getString("restore.content"),
                                    defaultNames.length, defaultNames, selection);
        if(!cancel)
          return;
        var engine = defaults[selection.value];
        if(engine.hidden)
          engine.hidden = false;
        node = gSEOrganizer.getItemByName(engine.name);
        var idx = gRemovedEngines.indexOf(node);
        if(node && idx !== -1) {
          gRemovedEngines = gRemovedEngines.slice(0, idx)
                                        .concat(gRemovedEngines.slice(idx + 1));
        }
        node = gSEOrganizer.getItemByName(engine.name);
        if(!node) {
          node = gSEOrganizer._getAnonymousResource();
        }
        item = new Structure__Item(gEngineView._structure, node, engine);
        this.showRestoreDefaults(defaults.length !== 1);
        break;
    }
    item.modified = true;
    parent.insertAt(insertLoc, item);
    gAddedEngines.push(node);

    gEngineView.updateCache();
    if((gSortDir == "ascending" || gSortDir == "descending") && !item.isSep) {
      parent.children = gResort(parent.children);
    }
    treeInsertLoc = gEngineView._indexCache.indexOf(item);
    gEngineView.rowCountChanged(treeInsertLoc, 1);
    gEngineView.selection.clearSelection();
    gEngineView.selection.select(treeInsertLoc);
    gEngineView.ensureRowIsVisible(treeInsertLoc);
    document.getElementById("engineList").focus();
  },
  selectAll: function EngineManager__selectAll() {
    gEngineView.selection.rangedSelect(0, gEngineView.lastIndex, false);
    document.getElementById("engineList").focus();
  },
  sortBy: function EngineManager__sortBy(direction) {
    var col = document.getElementById("engineName");
    gSortDir = direction;
    col.setAttribute("sortDirection", direction);

    document.getElementById(direction).setAttribute("checked", "true");
    switch(direction) {
      case "ascending":
      document.getElementById("descending").setAttribute("checked", "false");
      document.getElementById("natural").setAttribute("checked", "false");
      break;
      case "descending":
      document.getElementById("ascending").setAttribute("checked", "false");
      document.getElementById("natural").setAttribute("checked", "false");
      break;
      default:
      document.getElementById("ascending").setAttribute("checked", "false");
      document.getElementById("descending").setAttribute("checked", "false");
    }

    gEngineView.updateCache();
    gEngineView.invalidate();
  },

  onSelect: function EngineManager__onSelect() {
    var indexes = gEngineView.selectedIndexes;
    var disableButtons = (!indexes.length);
    var multipleSelected = (indexes.length > 1);
    var lastSelected = false, firstSelected = false, writeableSelected = true;
    var specialSelected = false, onlyEngines = true;

    var index, item, engine;
    for(var i = 0; i < indexes.length; i++) {
      index = indexes[i];
      item = gEngineView._indexCache[index];
      engine = item.originalEngine;
      if(item.parent.children.length - 1 == gEngineView.getLocalIndex(index))
        lastSelected = true;
      if(!gEngineView.getLocalIndex(index))
        firstSelected = true;
      if(item.isSep)
        onlyEngines = writeableSelected = !(specialSelected = true);
      else if(item.isSeq)
        onlyEngines = false;
      else if(!engine || engine.wrappedJSObject._readOnly)
        writeableSelected = false;
    }

    if(disableButtons) {
      writeableSelected = false;
      specialSelected = firstSelected = lastSelected = multipleSelected = true;
    } else if(multipleSelected) {
      writeableSelected = false;
      specialSelected = true;
    }
    /*var index = gEngineView.selectedIndex;
    var item = gEngineView._indexCache[index];
    var engine = item.originalEngine;

    var disableButtons = (gEngineView.selectedIndex === -1);
    var multipleSelected = (gEngineView.selectedIndexes.length != 1);
    var onlyOne = (gEngineView.lastIndex === 0);
    var lastSelected = (disableButtons || (item.parent.children.length - 1 ===
                                           gEngineView.getLocalIndex(index)));
    var firstSelected = (disableButtons || !gEngineView.getLocalIndex(index));
    var specialSelected = (disableButtons || item.isSep || multipleSelected);
    var writeableSelected = (specialSelected ||
                             (engine && engine.wrappedJSObject._readOnly));*/

    document.getElementById("cmd_remove").setAttribute("disabled", disableButtons);

    document.getElementById("cmd_rename").setAttribute("disabled",
                        !onlyEngines || multipleSelected || !writeableSelected);
    document.getElementById("cmd_move-engine").setAttribute("disabled", disableButtons);
    document.getElementById("cmd_editalias").setAttribute("disabled",
                                              !onlyEngines || multipleSelected);

    document.getElementById("cmd_moveup").setAttribute("disabled",
                                                       firstSelected);
    document.getElementById("cmd_movedown").setAttribute("disabled",
                                                         lastSelected);
  },

  loadAddEngines: function EngineManager__loadAddEngines() {
    this.onOK();
    window.opener.BrowserSearch.loadAddEngines();
    window.close();
  },

  startDrag: function EngineManager__startDrag(event) {
    if(event.target.localName === "treechildren")
      nsDragAndDrop.startDrag(event, gDragObserver);
  }
};
gEngineManagerDialog = new EngineManagerDialog();


function DragObserver() {
}
DragObserver.prototype = {
  onDragStart: function (aEvent, aXferData, aDragAction) {
    var selectedIndexes = window.gEngineView.selectedIndexes;
    if (!selectedIndexes.length)
      return;

    var data = selectedIndexes.join(FLAVOR_SEPARATOR);
    aXferData.data = new TransferData();
    aXferData.data.addDataForFlavour(ENGINE_FLAVOR, data);

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
  Structure__Container.apply(this, [null, rdfService.GetResource(ROOT)]);
  this.modified = false;
}
Structure.prototype = {
  node: null,
  parent: null,
  name: "",
  isSep: false,
  iconURI: "",
  isSeq: true,
  children: null,
  alias: "",
  modified: false,
  destroy: function Structure__destroy() {
    this.node = null;
    this.parent = null;
    this.children = null;
  },

  reloadIcons: function ES_reloadIcons() {
    this.children.forEach(function (e) {
      e.iconURI = e.originalEngine.uri;
    });
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
    var property, items, item;
    while(children.hasMoreElements()) {
      property = children.getNext();
      if(!rdfContainerUtils.IsOrdinalProperty(property))
         continue;

      items = gSEOrganizer.GetTargets(node, property, true);
      while(items.hasMoreElements()) {
        item = items.getNext();
        if(!(item instanceof Ci.nsIRDFResource))
          continue;

        if(gRemovedEngines.some(function(e) {
                                  return item.EqualsString(e.ValueUTF8);
                                }))
          continue;

        if(gSEOrganizer.HasAssertion(item, instanceOf, seq, true))
          this.push(new Structure__Container(this, item));
        else
          this.push(new Structure__Item(this, item));
      }
    }
  }
  this.modified = false;
}
Structure__Container.prototype = {
  node: null,
  parent: null,
  _name: "",
  get name() { return this._name; },
  set name(name) { this.modified = true; return this._name = name },
  children: null,
  open: false,
  isSep: false,
  isSeq: true,
  alias: "",
  modified: false,
  set iconURI() {
    Structure.prototype.reloadIcons.call(this);
  },
  originalEngine: null
};
function Structure__Item(parent, node, engine) {
  this.parent = parent;
  this.node = node;
  this.modified = false;
  if(!(engine instanceof Ci.nsISearchEngine))
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

  if(engine)
    this.modified = true;
  else
    engine = gSEOrganizer.getEngineByName(this.name);

  this.originalEngine = engine;
  if(engine) {
    this.alias = engine.alias;
    this.iconURI = engine.iconURI.spec;
  }
}
Structure__Item.prototype = {
  node: null,
  parent: null,
  _name: "",
  get name() { return this._name; },
  set name(name) { this.modified = true; return this._name = name },
  iconURI: "",
  isSep: false,
  isSeq: false,
  recursiveChildCount: 0,
  originalEngine: null,
  alias: "",
  commit: function Structure__Item__commit() {
    var engine = this.originalEngine;
    if(this.modified && engine) {
      if(engine.name !== this.name) {
        var oldName = engine.name;
        engine = engine.wrappedJSObject;
        var rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                           .getService(Ci.nsIRDFService);
        var namePred = rdfService.GetResource(NS + "Name");
        oldName = rdfService.GetLiteral(oldName);
        gSEOrganizer.Assert(this.node, namePred,
                            rdfService.GetLiteral(this.name), true);
        try {
          gSEOrganizer.Unassert(this.node, namePred, oldName);
        } catch(e) {}
        // we pretend the engine would have been updated - otherwise it'd need
        // a restart for Firefox to completely realize the engine changed
        var clone = {};
        for(var p in engine) {
          if(!(engine.__lookupGetter__(p) || engine.__lookupSetter__(p)))
            clone[p] = engine[p];
        }
        engine._name = this.name;
        engine._serializeToFile();
        engine._useNow = false;
        engine._engineToUpdate = clone;
        // we temporarily remove our service's observer so we don't end with
        // this engine being twice in the rdf
        var os = Cc["@mozilla.org/observer-service;1"]
                   .getService(Ci.nsIObserverService);
        //os.removeObserver(gSEOrganizer, SEARCH_ENGINE_TOPIC);
        os.notifyObservers(engine, SEARCH_ENGINE_TOPIC, "engine-loaded");
        //os.addObserver(gSEOrganizer, SEARCH_ENGINE_TOPIC, false);

        // update the orig search service's cache
        var realSearchService = gSEOrganizer._searchService;
        realSearchService.wrappedJSObject._engines[engine.name] = engine;
      }
      if(gSEOrganizer.getNameByItem(this.node) !== this.name) {
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
      if(this.alias != engine.alias) {
        engine.alias = this.alias;
      }
    }
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
  this.parent.modified = true;
  this.node = this.parent = this.children = this.modified = null;
};
Structure__Container.prototype.push = Structure.prototype.push =
           function Structure__General__push(what) {
  this.modified = true;
  this.children.push.apply(this.children, arguments);
};
Structure__Container.prototype.insertAt = Structure.prototype.insertAt =
           function Structure__General__insertAt(idx, item) {
  this.modified = true;
  item.parent = this;
  if(idx === -1 || idx > this.children.length) {
    this.children.push(item);
  } else if(idx === 0) {
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
  if(this.modified) {
    if(this instanceof Structure__Container) {
      if(gSEOrganizer.getNameByItem(this.node) !== this.name) {
        var rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                           .getService(Ci.nsIRDFService);
        var namePred = rdfService.GetResource(NS + "Name");
        var oldName = gSEOrganizer.GetTarget(this.node, namePred, true);
        gSEOrganizer.Assert(this.node, namePred, rdfService.GetLiteral(this.name),
                            true);
        if(oldName instanceof Ci.nsIRDFLiteral)
          gSEOrganizer.Unassert(this.node, namePred, oldName);
      }
    }
    var rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                       .getService(Ci.nsIRDFService);
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
          container.RemoveElementAt(i, true);
        } catch(e) { }
      }
    }
  }
  for(var i = 0; i < this.children.length; ++i) {
    this.children[i].commit();
  }
};
Structure__Container.prototype.find = Structure.prototype.find =
           function Structure__General__find(nodeID) {
  for(var i = 0, tmp; i < this.children.length; i++) {
    if(this.children[i].node.ValueUTF8 == nodeID)
      return this.children[i];
    if(this.children[i] instanceof Structure__Container) {
      tmp = this.children[i].find(nodeID);
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
    /*var rangeCount = seln.getRangeCount();
    var indexes = [], min = { }, max = { };
    for(var i = 0; i <= rangeCount; i++) {
      seln.getRangeAt(i, min, max);
      for(var j = min.value; j <= max.value; j++) {
        if(j != -1)
          indexes.push(j);
      }
    }*/
    return indexes;
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
  select: function EngineView__select(index0, index1, /*..., */ override) {
    var seln = gEngineView.selection;
    override = arguments[arguments.length - 1];
    if(override)
      seln.clearSelection();

    for(var i = 0; i < arguments.length - 1; ++i) {
      if(!seln.isSelected(arguments[i]))
        seln.toggleSelect(arguments[i]);
      this.ensureRowIsVisible(arguments[i]);
    }
  },
  invalidate: function EngineView__invalidate() {
    this.updateCache();
    return this.tree.invalidate();
  },
  rowCountChanged: function EngineView__rowCountChanged(index, count) {
    return this.tree.rowCountChanged(index, count);
  },
  ensureRowIsVisible: function (index) {
    this.tree.ensureRowIsVisible(index);
  },
  commit: function commit() {
    gSEOrganizer.beginUpdateBatch();
    for(var i = 0; i < gRemovedEngines.length; ++i) {
      if(gRemovedEngines[i] && gRemovedEngines[i] instanceof Ci.nsIRDFResource) {
        //gSEOrganizer.removeItem(gRemovedEngines[i]);
        // remove the underlying search engine file using nsIBrowserSearchService
        var name = gSEOrganizer.getNameByItem(gRemovedEngines[i]);
        var engine = gSEOrganizer.getEngineByName(name);
        if(engine && engine instanceof Ci.nsISearchEngine) {
          if(engine == gSEOrganizer.currentEngine)
            gSEOrganizer.currentEngine = gSEOrganizer.defaultEngine;
          gSEOrganizer.removeEngine(engine);
        }

        /* remove everything from the rdf tree */
        // remove everything this item references to
        var predicates = gSEOrganizer.ArcLabelsIn(gRemovedEngines[i]), parent, pred;
        while(predicates.hasMoreElements()) {
          pred = predicates.getNext();
          parent = gSEOrganizer.GetSources(pred, gRemovedEngines[i], true);
          while(parent.hasMoreElements()) {
            gSEOrganizer.Unassert(parent.getNext(), pred, gRemovedEngines[i], true);
          }
        }
        // remove all references to this item
        var predicates = gSEOrganizer.ArcLabelsOut(gRemovedEngines[i]), object;
        while(predicates.hasMoreElements()) {
          pred = predicates.getNext();
          object = gSEOrganizer.GetTargets(gRemovedEngines[i], pred, true);
           while(object.hasMoreElements()) {
            gSEOrganizer.Unassert(gRemovedEngines[i], pred, object.getNext(), true);
          }
        }
      }
    }
    this._structure.commit();
    gSEOrganizer.endUpdateBatch();
    gSEOrganizer.saveChanges();
  },

  engineVisible: function engineVisible(engine) {
    var folds = [{s: this._structure, i: 0}], lastIndex;
    while(folds.length) {
      lastIndex = folds.length - 1;
      for(var i = folds[lastIndex].i; i < folds[lastIndex].s.children.length; ++i) {
        if(folds[lastIndex].s.children[i].isSeq) {
          folds[lastIndex].i = i + 1;
          folds.push({s: folds[lastIndex++].s.children[i], i: i = -1});
        } else if(!folds[lastIndex].s.children[i].isSep) {
          if(folds[lastIndex].s.children[i].originalEngine === engine)
            return true;
        }
      }
      folds = folds.slice(0, lastIndex);
    }
    return false;
  },
  getLocalIndex: function getLocalIndex(idx) {
    return this._indexCache[idx].parent.children.indexOf(this._indexCache[idx]);
  },
  getSourceIndexesFromDrag: function getSourceIndexesFromDrag() {
    var dragService = Cc["@mozilla.org/widget/dragservice;1"].
                      getService().QueryInterface(Ci.nsIDragService);
    var dragSession = dragService.getCurrentSession();
    var transfer = Cc["@mozilla.org/widget/transferable;1"].
                   createInstance(Ci.nsITransferable);

    transfer.addDataFlavor(ENGINE_FLAVOR);
    dragSession.getData(transfer, 0);

    var dataObj = {};
    var len = {};
    var sourceIndexes = [];
    try {
      transfer.getAnyTransferData({}, dataObj, len);
    } catch (ex) {}

    if (dataObj.value) {
      sourceIndexes = dataObj.value.QueryInterface(Ci.nsISupportsString).data;
      sourceIndexes = sourceIndexes.substring(0, len.value).split(FLAVOR_SEPARATOR);
      for(var i = 0; i < sourceIndexes.length; i++) {
        sourceIndexes[i] = parseInt(sourceIndexes[i]);
      }
    }

    return sourceIndexes;
  },

  /* attempts to be compatible to the original code */
  get _engineStore() {
    return this._structure;
  },

  /* nsITreeView */
  get rowCount() {
    return this._indexCache.length;
  },
  selection: null,
  canDrop: function EngineView__canDrop(index, orientation) {
    var sourceIndexes = this.getSourceIndexesFromDrag();
    if(!sourceIndexes.length)
      return false;
    for(var i = 0; i < sourceIndexes.length; i++) {
      var sourceIndex = sourceIndexes[i];
      var sourceItem = this._indexCache[sourceIndex];
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
      natural: 'ascending',
      ascending: 'descending',
      descending: 'natural'
    };

    gEngineManagerDialog.sortBy(cycle[col.getAttribute("sortDirection")]);
  },
  drop: function EngineView__drop(treeDropIndex, orientation) {
    // find out indexes
    var treeSourceIndexes = this.getSourceIndexesFromDrag();
    var treeParentIndex = this.getParentIndex(treeDropIndex);
    var dropIndex;

    switch(orientation) {
      case Ci.nsITreeView.DROP_ON:
        treeParentIndex = treeDropIndex;
        dropIndex = -1;
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
    var items = [], tempDropIndex;
    for(var i = 0; i < treeSourceIndexes.length; i++) {
      var item = this._indexCache[treeSourceIndexes[i]];
      tempDropIndex = dropIndex;
      if(tempDropIndex != 0) {
        if(orientation == Ci.nsITreeView.DROP_BEFORE &&
           (treeDropIndex > treeSourceIndexes[i] || dropParent == item.parent)) {
          tempDropIndex = tempDropIndex - 1;
        } else if(orientation == Ci.nsITreeView.DROP_AFTER &&
                  (treeDropIndex < treeSourceIndexes[i] ||
                   dropParent != item.parent)) {
          tempDropIndex = tempDropIndex + 1;
        }
      }
      items[i] = this.internalMove(item, parent, tempDropIndex);
    }
    item = items[0];

    // update the tree and correct the selection
    this.updateCache();
    this.invalidate();
    var treeDropIndexes = [];
    for(var i = 0; i < items.length; i++) {
      treeDropIndexes[i] = this._indexCache.indexOf(items[i]);
    }
    treeDropIndexes.push(true);
    this.select.apply(this, treeDropIndexes);
    document.getElementById("engineList").focus();
  },
  internalMove: function(item, parent, index) {
    var treeParentIndex = this._indexCache.indexOf(parent);
    if(!item || !parent) {
      Components.reportError(new Error('an unknown error occured'));
      return false;
    }
    if(treeParentIndex != -1 && !this.isContainerOpen(treeParentIndex))
      this.toggleOpenState(treeParentIndex);
    var node = item.node;
    if(item.isSeq) {
      var children = item.children;
      item.destroy();
      item = item.replacedWith = new Structure__Container(parent, node, children, item.open);
    } else {
      item.destroy();
      item = new Structure__Item(parent, node);
    }
    parent.insertAt(index, item);
    return item;
  },
  getCellProperties: function EngineView__getCellProperties(row, col, props) {
    var aserv = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
    if(this.isSeparator(row))
      props.AppendElement(aserv.getAtom("separator"));
    if(col.id === "engineName")
      props.AppendElement(aserv.getAtom("Name"));
  },
  getCellText: function EngineView__getCellText(row, col) {
    var rowItem = this._indexCache[row];
    switch(col.id) {
      case "engineName":
        return rowItem.isSep ? "" : rowItem.name;
      case "engineAlias":
        return rowItem.isSep ? "" : rowItem.alias;
    }
    return "";
  },
  getCellValue: function EngineView__getCellValue(row, col) { },
  getColumnProperties: function EngineView__getColumnProperties(col, props) {
    var aserv = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
    props.AppendElement(aserv.getAtom(col.id));
    if(col.id == "engineName")
      props.AppendElement(aserv.getAtom("Name"));
  },
  getImageSrc: function EngineView__getImageSrc(row, col) {
    if(col.id === "engineName")
      return this._indexCache[row].iconURI;
    return "";
  },
  getLevel: function EngineView__getLevel(index) {
    var item = this._indexCache[index];
    if(!item)
      return -1;

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
    return this._indexCache[index].children.length === 0;
  },
  isContainerOpen: function EngineView__isContainerOpen(index) {
    return this._indexCache[index].open;
  },
  isEditable: function() { return false; },
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
  setCellText: function() {},
  setCellValue: function() {},
  setTree: function(tree) {
    this.tree = tree;
  },
  toggleOpenState: function(index) {
    var item = this._indexCache[index];
    var count = item.recursiveChildCount + 1;
    var open = (item.open = !item.open);
    this.updateCache();
    this.rowCountChanged(index + 1, (open ? 1 : -1) * count);
    this.invalidate();
    return open;
  }
};
} catch(e) {
  Components.reportError(e);
}
function LOG(msg) {
  /*msg = "Organize Search Engines:   " + msg;
  var consoleService = Cc["@mozilla.org/consoleservice;1"]
                         .getService(Ci.nsIConsoleService);
  consoleService.logStringMessage(msg);
  //dump(msg + "\n");
  return msg;*/
}