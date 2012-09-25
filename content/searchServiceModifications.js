/* -*- js-standard: mozscript; js-var:SearchService,Engine,notifyAction; -*- */
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
Portions created by the Initial Developer are Copyright (C) 2007-2009
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

/* this file is executed in the search service's scope via subScriptLoader */

// add a .wrappedJSObject property to the search service
(function _setUpWrappedJSObject() {
  var orig = SearchService.prototype.getEngines;
  SearchService.prototype.getEngines = function() { this.wrappedJSObject = this; };
  Cc["@mozilla.org/browser/search-service;1"]
                         .getService(Ci.nsIBrowserSearchService).getEngines({});
  SearchService.prototype.getEngines = orig; // restore the original function
})();

// add the folder chooser when a new engine is installed
(function _replaceAddEngineConfirmation() {

  Engine.prototype._confirmAddEngine = function confirmAddEngine() {
    var windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"]
                          .getService(Ci.nsIWindowWatcher);
    var parent = windowWatcher.activeWindow;
    if(!parent)
      return {confirmed: false, useNow: false};


    var seOrganizer = Cc["@mozilla.org/rdf/datasource;1?name=organized-internet-search-engines"].getService().wrappedJSObject;

    var sbs = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
    var stringBundle = sbs.createBundle(SEARCH_BUNDLE);
    
    var args = {

      titleMessage: stringBundle.GetStringFromName("addEngineConfirmTitle"),

      // Display only the hostname portion of the URL.
      dialogMessage: stringBundle.formatStringFromName("addEngineConfirmation",
                                               [this._name, this._uri.host], 2),

      checkboxMessage: stringBundle.GetStringFromName("addEngineUseNowText"),

      addButtonLabel: stringBundle.GetStringFromName("addEngineAddButtonLabel"),
      
      folder: null,
      
      confirmed: false,
      
      useNow: false,

    };

    parent.openDialog("chrome://seorganizer/content/confirmAddEngine.xul",
                      "_blank", "centerscreen,chrome,modal,titlebar", args);
    seOrganizer._engineFolders[this.name] = args.folder;
    return {confirmed: args.confirmed, useNow: args. useNow};
  };
})();


// we want to persist the user-chosen name and alias through an update
(function _replaceUpdateHandling() {
  var orig = SearchService.prototype._addEngineToStore;
  SearchService.prototype._addEngineToStore = function(aEngine) {
    var oldEngine = aEngine._engineToUpdate;
    if(oldEngine &&
       (aEngine.name != oldEngine.name || aEngine.alias != oldEngine.alias)) {
      aEngine._name = oldEngine.name;
      aEngine._alias = oldEngine.alias;
      if(!aEngine._readOnly)
        aEngine._serializeToFile();
    }
    orig.apply(this, arguments);
  };
})();

// make it possible to find out what was changed for "engine-changed" notifications
(function _replaceObserverNotifications() {
  var orig = notifyAction;
  notifyAction = function notify(aEngine, aVerb) {
    var caller = "";
    if(aVerb == "engine-changed" && notify.caller && notify.caller.name) {
      caller = aEngine.wrappedJSObject.__action || notify.caller.name;
      if(caller == "SRCH_SVC_addEngineToStore")
        caller = "update";
      else if(caller == "SRCH_ENG_setIcon" || caller == "iconLoadCallback")
        caller = "icon";
      else if(caller == "SRCH_SVC_moveEngine")
        caller = "move";
      else if(caller == "SRCH_SVC_setHidden")
        caller = "hidden";
      else if(caller == "SRCH_SVC_setAlias")
        caller = "alias";
      // there's also a caller "name" for renames and "properties" for everything
      aEngine.wrappedJSObject.__action = caller;
    }
    if(aVerb == "engine-added" || aVerb == "engine-removed" || caller == "move") {
      _filteredSortedEngines = null;
    }
    orig.apply(this, arguments);
    if(caller)
      delete aEngine.wrappedJSObject.__action;
  };
  Engine.prototype.__lookupSetter__("hidden").name = "SRCH_SVC_setHidden";
  Engine.prototype.__lookupSetter__("alias").name = "SRCH_SVC_setAlias";
})();

// cache the output of getSortedEngines
var _filteredSortedEngines = null;
SearchService.prototype._getSortedEngines = function getSorted(aWithHidden) {
  if(aWithHidden)
    return this._sortedEngines;
  if(!_filteredSortedEngines)
    _filteredSortedEngines = this._sortedEngines.filter(function(e)!e.hidden);
  return _filteredSortedEngines;
};