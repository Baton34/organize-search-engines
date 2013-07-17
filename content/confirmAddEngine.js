/* -*- js-standard: mozdomwindow,chromewindow,mozscript; js-import:;
       js-var:gCommonDialogParam;                                    -*- */
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
Portions created by the Initial Developer are Copyright (C) 2006-2013
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

Components.utils.import("resource://gre/modules/Services.jsm");
const Cc = Components.classes, Ci = Components.interfaces;

var organizeSE = {
  onEngineListChange: function organizeSE__onEngineListChange(item) {
    args.folder = item.selectedItem.id;
  },
  onAccept: function organizeSE__onAccept() {
    args.confirmed = true;
    if (document.getElementById("checkbox"))
      args.useNow = document.getElementById("checkbox").checked;

    let seOrganizer = Cc["@mozilla.org/rdf/datasource;1?name=organized-internet-search-engines"]
                        .getService().wrappedJSObject;
    seOrganizer._engineFolders[addedEngineName] = args.folder;
  },
  onLoadAlways: function organizeSE__onLoadAlways() {
    let enginePopup = document.getElementById("enginePopup");
    enginePopup.builder.rebuild();
    if(enginePopup.lastChild.nodeName == "template") {
      document.getElementById("engineList").parentNode.hidden = true;
      sizeToContent();
      return; // if there are no folders, a list is useless
    }

    if ("callBack" in window) { // Add to Search Bar add-on
      let cb = callBack;
      callBack = function() {
        organizeSE.onAccept();

        return cb.apply(this, arguments);
      };
    }

    this.observer.register();
  },
  onLoad: function organizeSE__onLoad() {
    window.args = window.arguments[0];
    window.addedEngineName = args.name;
    document.documentElement.setAttribute("title", args.titleMessage);
    document.getElementById("info.body").textContent = args.dialogMessage;
    document.getElementById("checkbox").label = args.checkboxMessage.replace(/&/, "");
    document.getElementById("checkbox").accessKey = args.checkboxMessage.replace(/^.*&(.).*$/, "$1");  
    document.documentElement.getButton("accept").label = args.addButtonLabel;
    args.folder = "urn:organize-search-engines:folders-root";

    this.onLoadAlways();

  },
  onClose: function organizeSE__onClose() {
    this.observer.unregister();
  },
  observer: {
    PREFNAME: "extensions.seorganizer.sortDirection",
    observe: function organizeSE__observer__observe(subject, topic, data) {
      if(topic != "nsPref:changed" || data !== "")
        return;
      subject.QueryInterface(Ci.nsIPrefBranch2);
      var direction = subject.getComplexValue("", Ci.nsISupportsString).data;
      var menupopup = document.getElementById("engineList").firstChild;
      menupopup.setAttribute("sortDirection", direction);
    },
    register: function organizeSE__observer__observe() {
      var branch = Services.prefs.getBranch(this.PREFNAME).QueryInterface(Ci.nsIPrefBranch2);
      branch.addObserver("", this, false);
      this.observe(branch, "nsPref:changed", "");
    },
    unregister: function organizeSE__observer__observe() {
      var branch = Services.prefs.getBranch(this.PREFNAME).QueryInterface(Ci.nsIPrefBranch2);
      branch.removeObserver("", this);
    }
  }
};

window.addEventListener("load", function() { organizeSE.onLoadAlways(); }, false);
window.addEventListener("close", function() { organizeSE.onClose(); }, false);
