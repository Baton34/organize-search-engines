/* -*- js-standard: mozdomwindow,chromewindow,mozscript;
       js-import:../chrome/content/resize-icons.js; js-var:;              -*- */
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

const Ci = Components.interfaces, Cc = Components.classes,
      Cr = Components.results, Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
                                  "resource://gre/modules/NetUtil.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "setTimeout",
                                  "resource://gre/modules/Timer.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Services",
                                  "resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Resizer",
                                  "resource://seorganizer/resize-icons.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "FileUtils",
                                  "resource://gre/modules/FileUtils.jsm");

const NS_RDF_DATASOURCE_PRE = "@mozilla.org/rdf/datasource;1?name=";

function LOG(msg) {
  msg = "Organize Search Engines:   " + msg;
  Services.console.logStringMessage(msg);
  //dump(msg + "\n");
  return msg;
}

/*try {*/

const FILENAME = "organize-search-engines.rdf";

const NS = "urn:organize-search-engines#";
const NS_RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const ROOT = "urn:organize-search-engines:root";
const FOLDERS_ROOT = "urn:organize-search-engines:folders-root";

//class constructor
function SEOrganizer() {
  this._rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                       .getService(Ci.nsIRDFService);
  this.wrappedJSObject = this;
  
  this._init();
}
SEOrganizer.prototype = {
  wrappedJSObject: null,
  classDescription: "For Organizing search engines in folders.",
  classID: Components.ID("{1a6b3e72-eb74-11db-9041-00ffd1e32fc4}"),
  contractID: NS_RDF_DATASOURCE_PRE + "organized-internet-search-engines",

  indexOutOfDate: true,
  _init: function SEOrganizer___init() {
    this._datasource = this._rdfService.GetDataSourceBlocking(this._saveURI);
    this._datasource.QueryInterface(Ci.nsIRDFRemoteDataSource);

    [ "defaultEngine" ].forEach((k) => this.__defineGetter__(k, () => Services.search[k]));
    [
      "addEngine", "addEngineWithDetails", "restoreDefaultEngines",
      "getDefaultEngines", "getEngineByAlias", "getEngineByName", "getEngines",
      "getVisibleEngines", "moveEngine", "removeEngine"
    ].forEach((k) => this[k] = Services.search[k].bind(Services.search));

    [ "URI", "loaded" ].forEach((k) => this.__defineGetter__(k, () => this._datasource[k]));

    [
      "Flush", "FlushTo",

      "ArcLabelsIn", "ArcLabelsOut", "Change", "DoCommand","GetAllCmds",
      "GetAllResources", "GetSource", "GetSources", "GetTargets", "hasArcIn",
      "hasArcOut", "HasAssertion", "IsCommandEnabled"
    ].forEach((k) => this[k] = this._datasource[k].bind(this._datasource));

    Services.obs.addObserver(this, "browser-search-engine-modified", false);

    // call *both* and save if at least one returned true
    let needSave = this._removeNonExisting();
    needSave = this._addMissingEnginesToRDF() || needSave;
    if(needSave)
      this.saveChanges();

    this._modifySearchService();

    this._createMultiEngine();
  },

  saveChanges: function SEOrganizer__saveChanges(dontResort) {
    this.Flush();

    if(!dontResort) {
      // tell the normal search service the right order
      // but we do it with some delays so we don't block the UI thread for ages
      if(this.indexOutOfDate)
        this._updateIndexCache();
      var instance = this;
      var addObserver = true;
      try {
        Services.obs.removeObserver(this, "browser-search-engine-modified");
      } catch(e) {
        addObserver = false;
      }
      var hiddenInTemplate = false;
      var engines = [];
      for(var i = 0; i < this._indexCache.length; ++i) {
        if(!this.isFolder(this._indexCache[i]) &&
           !this.isSeparator(this._indexCache[i])) {
          var name = this.getNameByItem(this._indexCache[i]);
          var engine = this.getEngineByName(name);
          if(engine instanceof Ci.nsISearchEngine && !engine.hidden) {
            engines.push(engine);
          } else {
            hiddenInTemplate = true;
          }
        }
      }
      setTimeout(this.__delayedMoveEngines, 0, 0, engines, this);
      if(hiddenInTemplate) {
        this._removeNonExisting();
        this.notifyObservers();
        this.saveChanges();
      }
      if(addObserver) {
        Services.obs.addObserver(instance, "browser-search-engine-modified", false);
      }
    }
  },
  __delayedMoveEngines: function delayedMoveEngines(i, engines, This) {
    if(engines.length <= i)
      return;
    for(var j = i; j < engines.length && j < i + 10; j++)
      This.moveEngine(engines[j], j);
    setTimeout(delayedMoveEngines, 30, j, engines, This);
  },

  reload: function SEOrganizer__reload() {
    //this.Refresh(true); // crashes when there is an empty folder
    this.beginUpdateBatch();
    this._datasource = this._rdfService.GetDataSourceBlocking(this._saveURI)
                           .QueryInterface(Ci.nsIRDFRemoteDataSource);
    for(var i = 0; i < this._observers.length; ++i) {
      this._datasource.AddObserver(this._observers[i]);
    }
    this.indexOutOfDate = true;
    this._addMissingEnginesToRDF();
    this._removeNonExisting();
    this.endUpdateBatch();

    this.notifyObservers();
  },

  _engineFolders: {},
  _engineIndexes: {}, // zero-base index
  // check if every installed (and visible) engine is in the rdf
  _addMissingEnginesToRDF: function addMissing(save) {
    var rdfService = this._rdfService;
    var rdfContainerUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                              .getService(Ci.nsIRDFContainerUtils);

    var root = rdfService.GetResource(ROOT);
    var rootContainer = rdfContainerUtils.MakeSeq(this, root);
    var name = rdfService.GetResource(NS + "Name");
    var engines = Services.search.getVisibleEngines({});

    var modified = false;
    for(var i = 0; i < engines.length; ++i) {
      if(!this.itemWithNameExists(engines[i].name)) {
        var container = rootContainer;
        var index = Number.POSITIVE_INFINITY;
        var cleanName = engines[i].name.replace(/\s+$/g, "");
        if(cleanName in this._engineFolders) {
          index = this._engineIndexes[cleanName];
          if(typeof index == "undefined")
            index = Number.POSITIVE_INFINITY;
          else
            delete this._engineIndexes[cleanName];
          var parent = this._engineFolders[cleanName];
          delete this._engineFolders[cleanName];
          if(parent == FOLDERS_ROOT)
            parent = ROOT;
          try {
            parent = rdfService.GetResource(parent);
            container = Cc["@mozilla.org/rdf/container;1"]
                          .createInstance(Ci.nsIRDFContainer);
            container.Init(this, parent);
          } catch(e) {
            container = rootContainer;
          }
        }
        try {
          var current = this._getAnonymousResource();
          if(index < container.GetCount() && index >= 0)
            container.InsertElementAt(current, index, true);
          else
            container.AppendElement(current);
          var currentName = rdfService.GetLiteral(engines[i].name);
          this.Assert(current, name, currentName, true);
          modified = true;
        } catch(e) {
          LOG(index);
          Components.reportError(e);
        }
      }
    }
    if(modified) {
      this.indexOutOfDate = true;
      if(save)
        this.saveChanges(true);
    }
    return modified;
  },
  // remove engines from the rdf that do not exist (anymore)
  _removeNonExisting: function removeNonExisting(save) {
    var modified = false;
    var resources = this.GetAllResources();
    var name = this._rdfService.GetResource(NS + "Name");
    while(resources.hasMoreElements()) {
      try {
        var item = resources.getNext().QueryInterface(Ci.nsIRDFResource);
        if(item.Value != ROOT && this.hasArcOut(item, name)) {
          var isEngine = !this.isFolder(item); // it has a name property, so can't be a separator
          var engineName = this.getNameByItem(item);
          var engine = this.getEngineByName(engineName);
          if((isEngine && (!engine || engine.hidden)) ||
             !this.ArcLabelsIn(item).hasMoreElements()) {
            this._internalRemove(item);
            modified = true;
          }
        }
      } catch(e) { }
    }
    if(save && modified)
      this.saveChanges(true);
    return modified;
  },


  _modifySearchService: function() {
    var topLevel = Cu.getGlobalForObject(this.defaultEngine.wrappedJSObject);
    var uri = "chrome://seorganizer/content/searchServiceModifications.js";
    Services.scriptloader.loadSubScript(uri, topLevel);
  },

  _createMultiEngine: function() {
    var prefs = Services.prefs;
    const CUR_ENGINE_PREF = "browser.search.selectedEngine";
    if(prefs.getPrefType(CUR_ENGINE_PREF) == Ci.nsIPrefBranch.PREF_STRING) {
      var curEngine = prefs.getComplexValue(CUR_ENGINE_PREF, Ci.nsISupportsString).data;
      if(this.currentEngine.name != curEngine && !this.getEngineByName(curEngine)) {
        var item = this.getItemByName(curEngine);
        if(item && this.isFolder(item)) {
          this.currentEngine = this.folderToEngine(item);
        }
      }
    }
  },

  observe: function observe(aEngine, aTopic, aVerb) {
    if(aTopic == "browser-search-engine-modified") {
      switch(aVerb) {
      case "engine-removed":
        this.beginUpdateBatch();
        if(this._removeNonExisting(true)) {
          this.notifyObservers();
        }
        this.endUpdateBatch();
        break;
      case "engine-added":
        this.beginUpdateBatch();
        if(this._addMissingEnginesToRDF(true)) {
          this.notifyObservers();
        }
        this.endUpdateBatch();
        break;
      case "engine-changed":
        // An engine was hidden, unhidden, moved, renamed, updated or an icon
        // changed.  We have to remove or add it from/to the RDF when it was
        // hidden/unhidden (this doesn't call removed/added).
        if(aEngine.wrappedJSObject.__action == "hidden") {
          this.observe(aEngine, aTopic, aEngine.hidden ? "engine-removed" : "engine-added");
        }
        /* falls through */
      case "engine-current": // The current engine was changed.
        var engines = this.getVisibleEngines({});
        for(var i = 0; i < engines.length; i++) {
          if(engines[i].wrappedJSObject._file.parent.path.indexOf("[fake]/") === 0 &&
             engines[i].name != aEngine.name)
            this.removeEngine(engines[i]);
        }
        break;
      case "engine-loaded": // An engine's/icon's download was completed.
        break;
      }
      // xxx we should notify rdf observers
    }
  },

  notifyObservers: function() {
    Services.obs.notifyObservers(null, "browser-search-engine-modified", "-engines-organized");
  },

  isFolder: function SEOrganizer__isFolder(aResource) {
    const rdfService = this._rdfService;
    return this.HasAssertion(aResource, rdfService.GetResource(NS_RDF + "instanceOf"),
                             rdfService.GetResource(NS_RDF + "Seq"), true);
  },
  newFolder: function SEOrganizer__newFolder(aFolderName, aParentFolder) {
    const rdfService = this._rdfService;
    const rdfContainerUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                                .getService(Ci.nsIRDFContainerUtils);

    if(!aParentFolder || !(aParentFolder instanceof Ci.nsIRDFResource))
      aParentFolder = this.getRoot();
    var parentFolder = Cc["@mozilla.org/rdf/container;1"]
                         .createInstance(Ci.nsIRDFContainer);
    parentFolder.Init(this, aParentFolder);

    var name = rdfService.GetResource(NS + "Name");
    var folderName = rdfService.GetLiteral(aFolderName);
    var folder = this._getAnonymousResource();
    this.Assert(folder, name, folderName, true);
    var container = rdfContainerUtils.MakeSeq(this, folder);
    parentFolder.AppendElement(folder);

    return folder;
  },

  isSeparator: function SEOrganizer__isSeparator(aResource) {
    const rdfService = this._rdfService;
    return this.HasAssertion(aResource, rdfService.GetResource(NS_RDF + "type"),
                             rdfService.GetResource(NS + "separator"), true);
  },
  newSeparator: function SEOrganizer__newSeparator(aParentFolder) {
    const rdfService = this._rdfService;
    const rdfContainerUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                                .getService(Ci.nsIRDFContainerUtils);

    if(!aParentFolder || !(aParentFolder instanceof Ci.nsIRDFResource))
      aParentFolder = this.getRoot();
    var parentFolder = rdfContainerUtils.MakeSeq(this, aParentFolder);

    var type = rdfService.GetResource(NS_RDF + "type");
    var separatorType = rdfService.GetResource(NS + "separator");
    var separator = this._getAnonymousResource();
    parentFolder.AppendElement(separator);
    this.Assert(separator, type, separatorType, true);

    return separator;
  },

  removeItem: function SEOrganizer__removeItem(aItem, aRecurse) {
    var toRemove = [aItem];

    if(this.isFolder(aItem) && aRecurse) { // find (grand-)children of this folder and remove them as well
      const rdfService = this._rdfService;
      const rdfContainerUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                                  .getService(Ci.nsIRDFContainerUtils);
      var container = Cc["@mozilla.org/rdf/container;1"]
                        .createInstance(Ci.nsIRDFContainer);
      container.Init(this, aItem);
      var containers = [{node: aItem, count: container.GetCount()}];
      for(let i = 0; i < containers.length; i++) {
        for(var j = 1; j <= containers[i].count; j++) {
          var item = this.GetTarget(containers[i].node,
                                    rdfService.GetResource(NS_RDF + "_" + j), true);
          toRemove.push(item);
          if(this.isFolder(item))
            containers.push({node: item, count: container.Init(this, item).GetCount()});
        }
      }
    }

    for(let i = 0; i < toRemove.length; ++i) {
      // remove the underlying search engine file using the search service
      var name = this.getNameByItem(toRemove[i]);
      if(name) { // this may be a separator
        var engine = this.getEngineByName(name);
        if(engine && engine instanceof Ci.nsISearchEngine) {
          this.removeEngine(engine);
          continue; // our observers already call _internalRemove!
        }
      }
      this._internalRemove(toRemove[i]);
    }
  },
  _internalRemove: function(aItem) { /* wipe aItem from the rdf tree */
    // remove everything this item does reference to
    var predicates = this.ArcLabelsIn(aItem), parent, pred;
    while(predicates.hasMoreElements()) {
      pred = predicates.getNext();
      parent = this.GetSources(pred, aItem, true);
      while(parent.hasMoreElements()) {
        this.Unassert(parent.getNext(), pred, aItem, true);
      }
    }
    // remove all references to this item
    predicates = this.ArcLabelsOut(aItem);
    let object;
    while(predicates.hasMoreElements()) {
      pred = predicates.getNext();
      object = this.GetTargets(aItem, pred, true);
      while(object.hasMoreElements()) {
        this.Unassert(aItem, pred, object.getNext(), true);
      }
    }
    this.indexOutOfDate = true;
  },

  getRoot: function SEOrganizer__getRoot() {
    return this._rdfService.GetResource(ROOT);
  },
  itemWithNameExists: function SEOrganizer__itemExists(aName) {
    if(!aName)
      return false;

    const rdfService = this._rdfService;
    var predicate = rdfService.GetResource(NS + "Name");
    var object = rdfService.GetLiteral(aName);
    if(this.hasArcIn(object, predicate)) {
      var ids = this.GetSources(predicate, object, true);
      while(ids.hasMoreElements()) {
        var id = ids.getNext();
        if(this.ArcLabelsIn(id).hasMoreElements()) {
          return true;
        }
      }
    }
    return false;
  },
  getNameByItem: function SEOrganizer__getNameByItem(aItem) {
    const rdfService = this._rdfService;
    var name = this.GetTarget(aItem, rdfService.GetResource(NS + "Name"), true);
    if(name instanceof Ci.nsIRDFLiteral)
      return name.Value;
    return "";
  },
  getIconByIndex: function SEOrganizer__getIconByIndex(aIndex) {
    if(aIndex != -1) {
      var predicate = this._rdfService.GetResource(NS + "Icon");
      var item = this.getItemByIndex(aIndex);

      var icon = this.GetTarget(item, predicate, true);
      if(icon instanceof Ci.nsIRDFLiteral)
        return icon.ValueUTF8;
    }
    return "";
  },
  getItemByName: function SEOrganizer__getItemByName(aName) {
    const rdfService = this._rdfService;
    return this.GetSource(rdfService.GetResource(NS + "Name"),
                          rdfService.GetLiteral(aName), true);
  },

  getParent: function SEOrganizer__getParent(aItem) {
    var predicates = this.ArcLabelsIn(aItem);
    if(predicates.hasMoreElements()) {
      return this.GetSource(predicates.getNext(), aItem, true);
    }
    return null;
  },

  _indexCache: [],
  getItemByIndex: function SEOrganizer__getItemByIndex(aIndex) {
    if(this.indexOutOfDate)
      this._updateIndexCache();
    if(this._indexCache.hasOwnProperty(aIndex))
      return this._indexCache[aIndex];
    return null;
  },
  _updateIndexCache: function _updateIndexCache() {
    if(this._updateBatchRunning)
      return;

    var cache = [];
    cache[-1] = this.getRoot();

    var count = 0;
    function callback(current) {
      cache[count++] = current;
      return false;
    }
    try {
      this._iterateAll(callback, this._iterateAllCallback_FilterNothing);
    } catch(e) { }
    this.indexOutOfDate = false;
    this._indexCache = cache;
    return cache;
  },
  indexOf: function SEOrganizer__indexOf(aItem, aGlobal) {
    if(aGlobal) {
      if(this.indexOutOfDate)
        this._updateIndexCache();
      return this._indexCache.indexOf(aItem);
    } else {
      var parent = this.getParent(aItem);
      var container = Cc["@mozilla.org/rdf/container;1"]
                        .createInstance(Ci.nsIRDFContainer);
      container.Init(this, parent);
      return container.IndexOf(aItem);
    }
  },
  getChildCount: function SEOrganizer__getChildCount(aItem) {
    const rdfService = this._rdfService;
    const rdfContainerUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                                .getService(Ci.nsIRDFContainerUtils);

    var container = Cc["@mozilla.org/rdf/container;1"]
                      .createInstance(Ci.nsIRDFContainer);
    container.Init(this, aItem);

    var count = container.GetCount();
    // find grandchildren:
    var containers = [container];
    for(var i = 0; i < containers.length; ++i) {
      var elems = containers[i].GetElements();
      while(elems.hasMoreElements()) {
        var elem = elems.getNext();
        if(this.isFolder(elem)) {
          container = rdfContainerUtils.MakeSeq(this, elem);
          containers.push(container);
          count += container.GetCount();
        }
      }
    }

    return count;
  },

  _iterateAllDefaultCallback: function callback(aNode) {
    return !(this.isFolder(aNode) || this.isSeparator(aNode));
  },
  _iterateAllCallback_FilterNothing: function callback(aNode) {
    return true;
  },
  _iterateAllCallback_FilterSeparators: function callback(aNode) {
    return !this.isSeparator(aNode);
  },
  /**
   * Iterates through all items and calls a callback function for each.
   *
   * @param aCallback The function to call.
   * @param aFilter   Optionally defines a function that is called before calling
   *                 callback. If filter returns false, the callback does not
   *                 get called. The default filters any folders and separators.
   *
   * @return false if abort exception is thrown, otherwise true.
   */
  _iterateAll: function iterateAll(aCallback, aFilter, aRoot) {
    const rdfService = this._rdfService;
    const rdfContainerUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                                .getService(Ci.nsIRDFContainerUtils);

    if(!aFilter)
      aFilter = this._iterateAllDefaultCallback;

    var root = aRoot || rdfService.GetResource(ROOT);
    var rootContainer = rdfContainerUtils.MakeSeq(this, root);
    var name = rdfService.GetResource(NS + "Name");

    let getChildrenRev = function (container) {
      var iter = XPCOMUtils.IterSimpleEnumerator(container.GetElements(),
                                                 Ci.nsIRDFResource);
      return [for (i of iter) i].reverse();
    };

    // recursion would be much simpler but it's better avoided
    var children = [], last;
    children.push(getChildrenRev(rootContainer));
    while(children.length) {
      last = children.length - 1;
      while(children[last].length) {
        var l = children[last].length - 1;
        var current = children[last][l];

        try {
          if(aFilter.call(this, current))
            aCallback.call(this, current, children[last]);
        } catch(e) {
          if(!(e instanceof Error))
            throw e;

          switch(e.message) {
          case "_iterateAll::succeeded":
            return true;
          case "_iterateAll::abort":
            return false;
          default:
            throw e;
          }
        }
        children[last] = children[last].slice(0, l);

        if(this.isFolder(current)) {
          var seq = rdfContainerUtils.MakeSeq(this, current);
          children.push(getChildrenRev(seq));
          ++last;
        }
      }
      children = children.slice(0, last);
    }

    return true;
  },

  folderToEngine: function(folder) {
    var ss = Services.search.wrappedJSObject;
    var name = this.getNameByItem(folder);
    var engine = ss.getEngineByName(name);
    var innerEngines = [];
    if(!engine) {
      engine = {
        alias: "",
        searchForm: "",
        hidden: false,
        _remove: function() {},
        iconURI: null,
        iconURL: "",
        name: name,
        type: 4,
        addParam: function() { throw Cr.NS_ERROR_FAILURE; },
        _file: { parent: {path: "[fake]/" + name + ".xml" }},
        _serializeToJSON: function() { return ""; },
        getSubmission: function(data, type) {
          var i = -1;
          var submission = {
            getNext: function() {
              i++;
              var submission = innerEngines[i].getSubmission(data, type);
              return submission;
            },
            hasMoreElements: function() i + 1 < innerEngines.length,
            QueryInterface: XPCOMUtils.generateQI([Ci.nsISimpleEnumerator, Ci.nsISearchSubmission])
          };
          submission.wrappedJSObject = submission;

          var first = submission.getNext();
          submission.postData = first.postData;
          submission.uri = first.uri;

          return submission;
        },
        supportsResponseType: function(type) {
          return (type === null || type == "text/html");
        },
        QueryInterface: XPCOMUtils.generateQI([Ci.nsISearchEngine])
      };
      engine.wrappedJSObject = engine;
      this._iterateAll(function(item) {
        innerEngines.push(this.getEngineByName(this.getNameByItem(item)));
      }, null, folder);

      if(!innerEngines.length)
        throw Cr.NS_ERROR_FAILURE;
      if(innerEngines.length == 1)
        return engine.innerEngines[0];

      var resizer = new Resizer(16, 16);
      resizer.onload = function iconLoadCallback() {
        resizer.paintIcons();
        engine.iconURI = NetUtil.newURI(resizer.getDataURL());
        engine.iconURL = engine.iconURI.spec;
        engine.__action = "icon";
        Cu.getGlobalForObject(ss).notifyAction(engine, "engine-changed");
      };
      innerEngines.forEach(function(e) {
        if(e.iconURI && e.iconURI.spec)
          resizer.addIconByURL(e.iconURI.spec);
        else // use transparent image
          resizer.addIconByImage(resizer._canvas.canvas.cloneNode(false));
      });
      ss._addEngineToStore(engine);
    }
    return engine;
  },

  // I know of at least one case, where an id was used twice, so we're making
  // sure here, this won't happen again in future
  _getAnonymousResource: function() {
    let ano;
    do {
      ano = this._rdfService.GetAnonymousResource();
    } while(this.ArcLabelsIn(ano).hasMoreElements() ||
            this.ArcLabelsOut(ano).hasMoreElements());
    return ano;
  },

  get _saveFile() {
    return FileUtils.getFile("ProfD", [FILENAME]);
  },
  get _saveURI() {
    var fileProtocolHandler = Cc["@mozilla.org/network/protocol;1?name=file"]
                                .getService(Ci.nsIFileProtocolHandler);
    return fileProtocolHandler.getURLSpecFromFile(this._saveFile);
  },
  _rdfService: null,
  _datasource: null,

  /* nsIBrowserSearchService */
  get currentEngine() {
    return Services.search.currentEngine;
  },
  set currentEngine(aEngine) {
    Services.search.currentEngine = aEngine;
    return aEngine;
  },

  /* nsIRDFRemoteDataSource */
  Init: function nsIRDFRemoteDataSource__Init(URI) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    //this._datasource.Init(URI);
  },
  Refresh: function nsIRDFRemoteDataSource__Refresh(blocking) {
    //this._datasource.Refresh(blocking);
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  /* nsIRDFDataSource */
  _observers: [],
  AddObserver: function nsIRDFDataSource__AddObserver(observer) {
    this._observers.push(observer);
    return this._datasource.AddObserver(observer);
  },
  Assert: function nsIRDFDataSource__Assert(source, property, target, truthValue) {
    var ret = this._datasource.Assert(source, property, target, truthValue);
    this.indexOutOfDate = true;
    return ret;
  },
  _updateBatchRunning: false,
  beginUpdateBatch: function nsIRDFDataSource__beginUpdateBatch() {
    this._updateBatchRunning = true;
    return this._datasource.beginUpdateBatch();
  },
  endUpdateBatch: function nsIRDFDataSouce__endUpdateBatch() {
    this._updateBatchRunning = false;

    return this._datasource.endUpdateBatch();
  },
  GetTarget: function nsIRDFDataSource__GetTarget(source, property, truthValue) {
    if(property.QueryInterface(Ci.nsIRDFResource).ValueUTF8 === NS + "Icon" &&
       !this.isFolder(source) && !this.isSeparator(source) && truthValue) {
      let name = this.getNameByItem(source);
      var engine = this.getEngineByName(name);
      if(engine && engine.iconURI)
        return this._rdfService.GetLiteral(engine.iconURI.spec);
    } else if(property.ValueUTF8 === NS + "Selected" &&
              !this.isSeparator(source) && truthValue) {
      let found = false;
      try {
        let name = this.currentEngine.name;
        found = (name == this.getNameByItem(source));
        if(!found && this.isFolder(source)) {
          this._iterateAll(function find(item) {
            if(this.getNameByItem(item) == name) {
              found = true;
              throw new Error("_iterateAll::succeeded");
            }
          }, null, source);
        }
      } catch(e) { }
      return this._rdfService.GetLiteral(found.toString());
    } else if(property.Value == NS + "Name" && this.isSeparator(source) &&
              truthValue) {
      try { // make the built-in sorting mechanism work
        var parent = Cc["@mozilla.org/rdf/container;1"]
                       .createInstance(Ci.nsIRDFContainer);
        parent.Init(this, this.getParent(source));
        var idx = parent.IndexOf(source);
        if(idx == -1 || idx === 0) {
          return this._rdfService.GetLiteral("");
        } else {
          var contUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                            .getService(Ci.nsIRDFContainerUtils);
          var arc = contUtils.IndexToOrdinalResource(idx - 1);
          var prevItem = this._datasource.GetTarget(parent.Resource, arc, true);
          var prevName = this.GetTarget(prevItem, property, true);
          if(!(prevName instanceof Ci.nsIRDFLiteral)) // separator is at top
            return this._rdfService.GetLiteral("\0\0\0\0\0\0\0\0\0\0\0\0\0\0"); // bah!
          return this._rdfService.GetLiteral(prevName.Value + "ZZZZZZZZZZZZZZ");
        }
      } catch(e) {
        return this._rdfService.GetLiteral("");
      }
    }
    try {
      return this._datasource.GetTarget(source, property, truthValue);
    } catch(e) {
      throw Cr.NS_ERROR_INVALID_ARG;
    }
  },
  Move: function nsIRDFDataSource__Move(oldSource, newSource, property, target) {
    var ret = this._datasource.Move(oldSource, newSource, property, target);
    this.indexOutOfDate = true;
    return ret;
  },
  RemoveObserver: function nsIRDFDataSource__RemoveObserver(observer) {
    var obs = this._observers;
    var index = obs.indexOf(observer);
    if(index != -1)
      this._observers.splice(index, 1);
    return this._datasource.RemoveObserver(observer);
  },
  Unassert: function nsIRDFDataSource__Unassert(source, property, target) {
    var ret = this._datasource.Unassert(source, property, target);
    this.indexOutOfDate = true;
    return ret;
  },

  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsISEOrganizer,
    Ci.nsIRDFDataSource,
    Ci.nsIBrowserSearchService,
    Ci.nsIObserver
  ])
};

function FoldersOnly() {
  XPCOMUtils.defineLazyGetter(this, "_rootContainer", () => {
    var datasource = Cc["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"]
                       .createInstance(Ci.nsIRDFInMemoryDataSource)
                       .QueryInterface(Ci.nsIRDFDataSource);
    var rdfService = Cc["@mozilla.org/rdf/rdf-service;1"]
                         .getService(Ci.nsIRDFService);
    var rdfContainerUtils = Cc["@mozilla.org/rdf/container-utils;1"]
                              .getService(Ci.nsIRDFContainerUtils);

    var root = rdfService.GetResource(FOLDERS_ROOT);
    return rdfContainerUtils.MakeSeq(datasource, root);
  });

  ["URI"].forEach((k) => {
    this.__defineGetter__(k, () =>{
      if (this._outOfDate)
        this._update();

      return this._rootContainer.DataSource[k];
    });
  });

  [
    "ArcLabelsIn", "ArcLabelsOut", "Assert", "beginUpdateBatch", "Change",
    "DoCommand", "endUpdateBatch", "GetAllCmds", "GetAllResources", "GetSource",
    "GetSources", "GetTarget", "GetTargets", "hasArcIn", "hasArcOut",
    "HasAssertion", "IsCommandEnabled", "Move", "Unassert"
  ].forEach((k) => {
    let This = this; // we can't use a arrow function here because it would crash Firefox 22.
    this[k] = function() {
      if (This._outOfDate)
        This._update();

      let ds = This._rootContainer.DataSource;
      return ds[k].apply(ds, arguments);
    };
  });

  if (Services.vc.compare("23.0", Services.appinfo.platformVersion) >= 0) {
    this._update();
  }

  Services.obs.addObserver(this, "browser-search-engine-modified", false);
}
FoldersOnly.prototype = {
  classDescription: "For Organizing search engines in folders.",
  classID: Components.ID("{f2fa3794-eb73-11db-9d18-00ffd1e32fc4}"),
  contractID: NS_RDF_DATASOURCE_PRE + "organized-internet-search-folders",

  _outOfDate: true,
  _observers: [],

  _update: function() {
    this._outOfDate = false;

    this.beginUpdateBatch();
    let rootContainer = this._rootContainer;
    var seOrganizer = Cc[SEOrganizer.prototype.contractID].getService().wrappedJSObject;

    // clean up old stuff
    var elements = rootContainer.GetElements(), hasMore = elements.hasMoreElements();
    while(hasMore) // only renumber once
      rootContainer.RemoveElement(elements.getNext(), !(hasMore = elements.hasMoreElements()));

    try {
      if(seOrganizer.indexOutOfDate)
        seOrganizer._updateIndexCache();
      for(var i = 0; i < seOrganizer._indexCache.length; i++) {
        var item = seOrganizer.getItemByIndex(i);
        if(!item)
          break;
        if(seOrganizer.isFolder(item))
          rootContainer.AppendElement(item);
      }
    } catch(e) {}
    this.endUpdateBatch();
  },

  AddObserver: function nsIRDFDataSource__AddObserver(observer) {
    this._rootContainer.DataSource.AddObserver(observer);

    if (this._observers.indexOf(observer) == -1)
      this._observers.push(observer);
  },
  RemoveObserver: function nsIRDFDataSource__RemoveObserver(observer) {
    if (this._observers.indexOf(observer) != -1)
      this._observers.splice(this._observers.indexOf(observer), 1);

    this._rootContainer.DataSource.RemoveObserver(observer);
  },

  observe: function(aEngine, aTopic, aVerb) {
    if(aTopic == "browser-search-engine-modified" && aVerb == "-engines-organized") {
      this._outOfDate = true;

      if (this._observers.length > 0) {
        this._update();
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIRDFDataSource, Ci.nsIObserver])
};
/*} catch(e) {
  Components.reportError(e);
}*/

var NSGetFactory = XPCOMUtils.generateNSGetFactory([SEOrganizer, FoldersOnly]);
