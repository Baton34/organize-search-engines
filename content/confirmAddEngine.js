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

var organizeSE = {};
organizeSE.__proto__ = {
  onEngineListChange: function organizeSE__onEngineListChange(item) {
    if(this.inCommonDialog) {
      if("setProperty" in gCommonDialogParam) // Firefox 4+
        gCommonDialogParam.setProperty("ose-folder", item.selectedItem.id);
      else
        gCommonDialogParam.SetString(13, item.selectedItem.id);
    } else {
      this.folderID = item.selectedItem.id;
    }
  },
  inCommonDialog: null,
  folderID: "urn:organize-search-engines:folders-root",
  onLoad: function organizeSE__onLoad() {
    if(!document.getElementById("engineList"))
      return; // in case the user uses an old version of add to search bar
    if(document.getElementById("enginePopup").lastChild.nodeName == "template") {
      document.getElementById("engineList").parentNode.hidden = true;
      sizeToContent();
      return; // if there are no folders, a list is useless
    }
    this.observer.register();
    if(!(this.inCommonDialog = "gCommonDialogParam" in window)) {
      var origOnDialogAccept = onDialogAccept;
      onDialogAccept = function(e) {
        var seo = Cc["@mozilla.org/rdf/datasource;1?name=organized-internet-search-engines"]
                    .getService().wrappedJSObject;
        var name = document.getElementById("name").value.replace(/\s+$/g, "");
        seo._engineFolders[name] = organizeSE.folderID;
        origOnDialogAccept(e);
      };
    }
  },
  onClose: function organizeSE__onClose() {
    this.observer.unregister();
  },
  observer: {
    PREFNAME: "extensions.seorganizer.sortDirection",
    observe: function organizeSE__observer__observe(subject, topic, data) {
      if(topic != "nsPref:changed" || data != "")
        return;
      subject.QueryInterface(Ci.nsIPrefBranch2);
      var direction = subject.getComplexValue("", Ci.nsISupportsString).data;
      var menupopup = document.getElementById("engineList").firstChild;
      menupopup.setAttribute("sortDirection", direction);
    },
    register: function organizeSE__observer__observe() {
      var prefService = Cc["@mozilla.org/preferences-service;1"]
                          .getService(Ci.nsIPrefService);
      var branch = prefService.getBranch(this.PREFNAME).QueryInterface(Ci.nsIPrefBranch2);
      branch.addObserver("", this, false);
      this.observe(branch, "nsPref:changed", "");
    },
    unregister: function organizeSE__observer__observe() {
      var prefService = Cc["@mozilla.org/preferences-service;1"]
                          .getService(Ci.nsIPrefService);
      var branch = prefService.getBranch(this.PREFNAME).QueryInterface(Ci.nsIPrefBranch2);
      branch.removeObserver("", this);
    }
  }
};
window.addEventListener("load", function() { organizeSE.onLoad(); }, false);
window.addEventListener("close", function() { organizeSE.onClose(); }, false);