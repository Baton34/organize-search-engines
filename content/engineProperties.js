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

The Original Code is Add to Search Bar.

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

const Ci = Components.interfaces, Cc = Components.classes, Cu = Components.utils;

const ICON_DATAURL_PREFIX = "data:image/x-icon;base64,";
const CANVAS_DATAURL_PREFIX = "data:image/png;base64,";
const MAX_ICON_SIZE = 10000;

const NS_HTML = "http://www.w3.org/1999/xhtml";

var gEngine = window.arguments[0];

function init() {
  document.getElementById("keyword-textbox").value = gEngine.alias;

  document.getElementById("name-textbox").value = gEngine.name;
  iconMethods.changeIcon(gEngine.iconURI, 0);
  var origEngine = gEngine.originalEngine.wrappedJSObject;
  var ssGlobalObject = Cu.getGlobalForObject(origEngine);
  if(origEngine.__updateToEngine)
    origEngine = origEngine.__updateToEngine;
  document.getElementById("description-textbox").value = origEngine.description;
  document.getElementById("homepage-textbox").value = origEngine.searchForm;
  document.getElementById("encoding-textbox").value = origEngine._queryCharset;
  document.getElementById("update-interval-textbox").value = origEngine._updateInterval;
  document.getElementById("update-url-textbox").value = origEngine._updateURL;
  document.getElementById("update-icon-url-textbox").value = origEngine._iconUpdateURL;
  //var dataType = ssGlobalObject.engineMetadataService.getAttr(origEngine, "updatedatatype");
  var dataType="DATA_TXT";
  var type = document.getElementById("update-data-type-menulist");
  for(var i = 0; i < type.itemCount; i++) {
    if(dataType == Ci.nsISearchEngine[type.getItemAtIndex(i).value]) {
      type.selectedIndex = i;
      break;
    }
  }
  checkUpdates();

  var url = origEngine._getURLOfType("text/html");
  document.getElementById("method-radio").selectedIndex = (url.method == "GET" ? 0 : 1);
  document.getElementById("url-textbox").value = url.template;
  if(!ssGlobalObject.getBoolPref(ssGlobalObject.BROWSER_SEARCH_PREF + "update", true)) {
    ["update-interval-row", "update-url-row", "update-icon-url-row"].forEach(function(id) {
      document.getElementById(id).hidden = true;
    });
  }
  var tree = document.getElementById("params-tree");
  tree.addEventListener("keypress", function(event) {
    if(event.keyCode != event.DOM_VK_ENTER && event.keyCode != event.DOM_VK_RETURN)
      return;
    event.preventDefault();
    if(tree._editingColumn) {
      tree.stopEditing(true);
      setTimeout(function() {
        tree.focus();
      }, 50);
    } else
      tree.startEditing(tree.view.selection.currentIndex, tree.columns.getFirstColumn());
  }, true);
  tree.view = new ParamTreeView(url.params);

  if(origEngine._readOnly) {
    [
      "name-textbox","icon-button","icon-download-button","description-textbox",
      "homepage-textbox","url-textbox","encoding-textbox","method-radio-get",
      "method-radio-post","add-param","remove-param","params-tree",
      "update-url-textbox","update-data-type-menulist","update-icon-url-textbox",
      "update-interval-row"
    ].forEach(function(id) document.getElementById(id).disabled = true);
  }
}


/* disable update stuff when there's no update urls */
function checkUpdates() {
  var disable1 = !(document.getElementById("update-url-textbox").value);
  var disable2 = !(document.getElementById("update-icon-url-textbox").value);
  document.getElementById("update-data-type-menulist").disabled = disable1;
  document.getElementById("update-interval-textbox").disabled = disable1 && disable2;
}

/* clone a nsISearchEngine, replacement is delayed until ok is clicked in the manager */
function cloneEngine(engine, dataType) {
  engine = engine.wrappedJSObject;
  if(engine._engineToUpdate)
    return engine;
/* 
 var toplevel = Cu.getGlobalForObject(engine);
  var Engine = toplevel.Engine;
  dataType = Ci.nsISearchEngine[dataType];
  var newEngine = new Engine(engine._file, dataType, engine._readOnly);
  for(var property in engine) {
    if(!(engine.__lookupGetter__(property) || engine.__lookupSetter__(property)) &&
       engine.hasOwnProperty(property) && property != "__updateToEngine")
      newEngine[property] = engine[property];
  }
  engine.__updateToEngine = newEngine;
  newEngine._dataType = dataType;
  return newEngine;
  */
  return engine;
}

function storeChanges() {
  gEngine.alias = document.getElementById("keyword-textbox").value;
  var origEngine = gEngine.originalEngine.wrappedJSObject;
  if(origEngine._readOnly)
    return;

  var newEngine = cloneEngine(origEngine, document.getElementById("update-data-type-menulist").value);

  gEngine.name = document.getElementById("name-textbox").value;
  gEngine.iconURI = document.getElementById("icon-image").src;
  newEngine._description = document.getElementById("description-textbox").value;
  newEngine._searchForm = document.getElementById("homepage-textbox").value;
  newEngine._queryCharset = document.getElementById("encoding-textbox").value;
  var url = newEngine._getURLOfType("text/html");
  url.method = (document.getElementById("method-radio").selectedIndex === 0) ? "GET" : "POST";
  url.template = document.getElementById("url-textbox").value;
  var params = document.getElementById("params-tree").view.wrappedJSObject.params;

  var newParams = Cu.getGlobalForObject(origEngine).Array(); // don't leak this window
  var QueryParameter = Cu.getGlobalForObject(origEngine).QueryParameter;
  for(var i = 0; i < params.length; i++) {
    var value = params[i].split("=");
    newParams.push(new QueryParameter(value.shift(), value.join("=")));
  }
  url.params = newParams;

  newEngine._updateInterval = document.getElementById("update-interval-textbox").valueNumber || null;
  newEngine._updateURL = document.getElementById("update-url-textbox").value || null;
  newEngine._iconUpdateURL = document.getElementById("update-icon-url-textbox").value || null;
}


/* the parameter tree view */
function ParamTreeView(params) {
  if(!params)
    params = [];
  this.params = params.map(function(val) {
    return val.name + "=" + val.value;
  });
  this.wrappedJSObject = this;
}
ParamTreeView.prototype = {
  wrappedJSObject: null,
  params: null,
  get rowCount() { return this.params.length; },
  getCellText: function(row) {
    return this.params[row];
  },
  setCellText: function(row, col, text) {
    this.params[row] = text;
    this._treebox.invalidateCell(row, col);
  },
  _treebox: null,
  setTree: function(treebox) { this._treebox = treebox; },
  isContainer: function() { return false; },
  isSeparator: function() { return false; },
  isSorted: function() { return false; },
  isEditable: function() { return true; },
  getLevel: function() { return -1; },
  getImageSrc: function() { return null; },
  getRowProperties: function() {},
  getColumnProperties: function() {},
  getCellProperties: function() {},
  performAction: function(action) {
    switch(action) {
    case 'add':
      var row = this.selection.currentIndex + 1;
      var col = this._treebox.columns.getFirstColumn();
      this.params.splice(row, 0, "");
      this._treebox.rowCountChanged(row, 1);
      var tree = this._treebox.treeBody.parentNode;
      tree.focus();
      tree.startEditing(row, col);
      break;
    case 'remove':
      this.params.splice(this.selection.currentIndex, 1);
      this._treebox.rowCountChanged(this.selection.currentIndex, -1);
      break;
    }
  }
};

/* icon stuff */
var iconMethods = {
  browseIcon: function browseIcon() {
    try {
      var icon = document.getElementById("icon-image");

      var fp = Cc["@mozilla.org/filepicker;1"]
                 .createInstance(Ci.nsIFilePicker);
      fp.init(window, "", Ci.nsIFilePicker.modeOpen);
      fp.appendFilters(Ci.nsIFilePicker.filterAll | Ci.nsIFilePicker.filterImages);
      fp.filterIndex = 1; // preselect images
      fp.displayDirectory = Cc["@mozilla.org/file/directory_service;1"]
                            .getService(Ci.nsIProperties).get("Home", Ci.nsIFile);

      if(icon.file && icon.file instanceof Ci.nsILocalFile) {
        if(icon.file.parent.exists())
          fp.displayDirectory = icon.file.parent;
        if(icon.file.exists())
          fp.defaultString = icon.file.leafName;
      }

      var rv = fp.show();
      if(rv != Ci.nsIFilePicker.returnOK)
        return;
      var file = fp.file;
      if(!file.exists() || !file.isReadable() || file.isDirectory())
        return;

      icon.file = file;
      iconMethods.changeIcon(fp.fileURL.spec, 2);
    } catch(e) {
      Components.reportError(e);
    }
  },
  downloadIcon: function downloadIcon(button) {
    button.image = "chrome://seorganizer/skin/loading_16.png";

    var iframe = document.getElementById("favicon");

    iframe.docShell.allowPlugins = false;
    iframe.docShell.allowJavascript = false;
    iframe.docShell.allowMetaRedirects = false;
    iframe.docShell.allowSubframes = false;
    iframe.docShell.allowImages = false;
    iframe.docShell.allowAuth = false;

    iframe.addEventListener("load", iconMethods.downloadIcon2, true, true);

    iframe.webNavigation.loadURI(document.getElementById("homepage-textbox").value, 0, null, null, null);
  },
  downloadIcon2: function downloadIcon2(event) {
    var iframe = event.currentTarget;
    if (event.target != iframe.contentDocument)
        return;

    var faviconURI = iframe.webNavigation.currentURI.prePath + "/favicon.ico";
    let selector = 'link[rel="shortcut icon"]:link, link[rel="icon"]:link';
    var links = iframe.contentDocument.querySelectorAll(selector);
    for(var i = 0; i < links.length; i++) {
      if(("body" in iframe.contentDocument || link[i].namespaceURI == NS_HTML)) { // we only want to check HTML nodes
        faviconURI = links[i].href;
        break;
      }
    }
    document.getElementById("icon-download-button").image = "";
    iconMethods.changeIcon(faviconURI, 1);
  },
  changeIcon: function changeIcon(url, verbose) {
    var image = new Image();
    image.onload = function() {
      var icon = document.getElementById("icon-image");
      var ctx = icon.getContext("2d");
      ctx.fillStyle = ctx.strokeStyle = "rgba(0,0,0,0)"; // transparent
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.drawImage(image, 0, 0, 16, 16);
      var size = atob(icon.toDataURL().substr(CANVAS_DATAURL_PREFIX.length)).length;
      if(size > MAX_ICON_SIZE) {
        dump("Organize Search Engines:changeIcon icon too large (" + url + ")\n");
        if(verbose)
          iconMethods.showMessage("fileSizeTitle", "fileSizeMessage", null,
            [(MAX_ICON_SIZE / 1024).toFixed(2), (size / 1024).toFixed(2)]);
        if(icon.src != url)
          changeIcon(icon.src, false);
      } else {
        icon.src = icon.toDataURL();
        if(verbose) {
          document.getElementById("update-icon-url-textbox").value = (verbose == 1 ? url : "");
          checkUpdates();
        }
        icon.setAttribute("tooltiptext", url);
        icon.style.backgroundImage = null;
      }
    };
    image.onerror = function() {
      dump("Organize Search Engines:changeIcon image type not supported (" + url + ")\n");
      if(verbose == 1)
        iconMethods.showMessage("unsupportedImageTitle", "unsupportedImageMessageDownload");
      else if(verbose == 2)
        iconMethods.showMessage("unsupportedImageTitle", "unsupportedImageMessageBrowse");
      if(icon.src != url)
        iconMethods.changeIcon(icon.src, 0);
    };
    image.src = url;
  },

  showMessage: function showMessage(title, text, fmtTitle, fmtText) {
    var sbs = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
    var stringBundle = sbs.createBundle("chrome://seorganizer/locale/engineProperties.properties");
    if(fmtTitle)
      title = stringBundle.formatStringFromName(title, fmtTitle, fmtTitle.length);
    else
      title = stringBundle.GetStringFromName(title);
    if(fmtText)
      text = stringBundle.formatStringFromName(text, fmtText, fmtText.length);
    else
      text = stringBundle.GetStringFromName(text);
    var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
    prompts.alert(window, title, text);
  }
};
