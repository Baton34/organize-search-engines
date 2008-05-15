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
Portions created by the Initial Developer are Copyright (C) 2007-2008
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

/* The class arranges the provided images in two rows in the provided dimensions.
   It will do both upscale and downscale the images when neccessary. If the
   number of images is odd, the image of biggest height (then width, then order)
   will be the last image in doubled height.

example usage:
      var image1 = "data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAHWSURBVHjaYvz//z8DJQAggJiQOe/fv2fv7Oz8rays/N+VkfG/iYnJfyD/1+rVq7ffu3dPFpsBAAHEAHIBCJ85c8bN2Nj4vwsDw/8zQLwKiO8CcRoQu0DxqlWrdsHUwzBAAIGJmTNnPgYa9j8UqhFElwPxf2MIDeIrKSn9FwSJoRkAEEAM0DD4DzMAyPi/G+QKY4hh5WAXGf8PDQ0FGwJ22d27CjADAAIIrLmjo+MXA9R2kAHvGBA2wwx6B8W7od6CeQcggKCmCEL8bgwxYCbUIGTDVkHDBia+CuotgACCueD3TDQN75D4xmAvCoK9ARMHBzAw0AECiBHkAlC0Mdy7x9ABNA3obAZXIAa6iKEcGlMVQHwWyjYuL2d4v2cPg8vZswx7gHyAAAK7AOif7SAbOqCmn4Ha3AHFsIDtgPq/vLz8P4MSkJ2W9h8ggBjevXvHDo4FQUQg/kdypqCg4H8lUIACnQ/SOBMYI8bAsAJFPcj1AAEEjwVQqLpAbXmH5BJjqI0gi9DTAAgDBBCcAVLkgmQ7yKCZxpCQxqUZhAECCJ4XgMl493ug21ZD+aDAXH0WLM4A9MZPXJkJIIAwTAR5pQMalaCABQUULttBGCCAGCnNzgABBgAMJ5THwGvJLAAAAABJRU5ErkJggg==";
      var image2 = makeURI("data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAALISURBVHjajJNLTBNRFIbPnZk6CAVKpQ8aQggSJLFu1IQ0MT4TrRuMMZGdVlkUF5IYwwqJaGp0oUk3io+FiawMQtV0UdiIbNBg1ZaSQhMpFCt9SFuadqaPmbneApLRIPEkX2bm5Ny55//PvQhk4XK5brvdbnM8Hjfk83mFJEkiRVGJSCTy1mw2P7BarSuwXbS0tMwYDAasVqtxTU0NJik5HfAfcYBwlxCVLRwn9BHorRYwTqezXxAEJcZYomk6y3Fcym63cx6PB3ieB5Jz2Gy2RH19/Q2v1xtubm52yKUgi8USSyaTGlEU1xKlZywWA7/fD8QD0Ol0JWnAsmzJI5FstpeUzW22YDKZFv7Suh08Yc/o6Gh3Z2fns8HBQQ0Y6+pCFQiVtp9QIcRpEcKaf7ALoexCIFB3r7d38pDRiEntZTTMsp4xUXz/RBC6R1j2sR4hK97KLYQAMQzWtrW9EVWqExGns3Jakp7SMYxfD4viUKnmfleXXgyH21EmA0zJYTkYA0PTqJhMtoqxGJslNT8BZplxSYpsjqShsVqh00MxGt1yxvP5PCgJRDII5IeiiIFa6rk+8+NOn329Tf40xa6PW5I59/ubK4GoVWbDzXwVnWOqzxdrAQeu5i7dPC7EU62oNQfRUBOks6KEAAoaFVOmVSugooyCYriQ6x8IHXne13QrEeTPrExnFhm6huPKWT0FQmIfq2ZgLgTwcSn3cPJLeiqVFjLHTKqqi2e1F2ob9h8No6kyXEkrh76m7RSgoGeRf8SAQCPYQRrFBeAzn6HBwEImI7xyjK2UjjC8+7AKPd2WU4jh1+RUldMV12zBsY0jDoyUm2e/LacgX5DWtO4krZ47WTty0Kg83H7F7+OD/QMg+DqWo0uQWhVAELDij7vwyRt5MRvkdsuTNIUY10Sykbz6fG7HXGCBf0k8YbAExUIRf5fX/hJgAKtVXu7W01nMAAAAAElFTkSuQmCC");
      var image3 = new Image("http://www.google.de/images/firefox/google.gif");
      var resizer = new Resizer(24, 16, image1, image2, image3);
      resizer.onload = function() {
        resizer.paintIcons();
        // do something more useful!
        prompt("URI:", resizer.getDataURL());
      };
      resizer.addIconByURL("data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAIjSURBVHjanJFfSFNRHMe/9+xud/+62ubmYIEFoZUpvrQ99JD1HFFvPQVhZVIo5KugElTkSKOoDAZB4EsP1WtQFBixF4shtWkMi4bztpzuunvddPd0znSVeQ3yB18u5/7O9/P7nnMESim2qgej0XabJPXX+evb3bKMxYUcctnsh1KxOHixs+MZ3yNsBRgeuXthf0vraEPTAVBiQXWfBQa+TiWQmko+YpCzpoC+voHDR44dHd/d3IZCcWVT3ymJSE3GMfN5+hT5uykIgrTT6xnY29y6wWywQYt6CT+WlvFdXUbTwRYQQvpFk/RefyAY0o3fP7hRUXWIFgKHTYRQLkMrUwiSq80M4MzldZka9Jc5k9dYbCtqnRJkuxWSaIGLrRfyDGoCIGllPs0mBYtasTLZxgzc7HPbUeOwVVIQCMgyADEBrIxPfIyVtAK00ip4ED69xr6WwOuSKpC0kkUsnnxtBtA9FhWRe48RkB0gAljktbM7mXiazLyK29EnWDWMwU3POBQZicxm5npnVQppRy16zp2GL+CDlRC42fMlZ9KIjj3HRDzR+e7p/Ycb7uD6jcjlcDjU663z4eSZbugF9dqn6dS+hl3BcL3fE5xjd/PlWzpW0pduvX8x9rZi4gm4bg4Nd7189YYqSpZeuXqHHjrecYm1A0x7mBrXv3wtVT2V9Gbm0InzXX9u+pd4yds1VwGN8cnEtsxcwvr5eGWY8vjP+inAAAnCYGlDtONUAAAAAElFTkSuQmCC");
      window.setTimeout(function() {
          resizer.addIconByURL("data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAFXRFWHRDcmVhdGlvbiBUaW1lAAfVAhwHAzet9p9CAAAAB3RJTUUH1QIcBwQN8bozRwAAAAlwSFlzAAALEgAACxIB0t1+/AAAAwBQTFRFAQEBAwMDCAcHEhUUGRkeHB4YGCEIHyEbHSQZHyshITQZLDcWKjUaLDocLj4fIyMiIiYkJygnLi0rLS8tJzMjIjApLzEuLzgjLjwiLjwmLj4qMjIsMjUtMTonMT4iMj4oMzwtMjMyNTU0Njg4ODo3MEEeMkQbNkEuPE4nPkktP0Y7PUk3QE0wQU41QlQvQ1U0Q1c1RVg2SVA5SVI/SmAwTWwxU3M2UnU2UnI6U3k8Ynw9REVCRkdCSUxDTVJGTVBLTV9ATVNVU1ZPU1ZTWl9UUGBJWmFMW2JUXWNcXGVYXH1CW31WYXJVZXlbZ3hebn5cc3xZc31dZ2dlaWplaHtgbH9nYYhKa4NZapBTcoJWcoRYf41VeYtYeY5bcpNfdphRfIpyd5FjdZJniJhegIxiiZp5kppuhaJpjKtwkKJlmqlqio+CipGJjJSMn5qdnKmFp7eFuciI/v/+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM8H1iAAAAHN0Uk5T////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AO+Lr34AAACrSURBVHjaYygqKtL1TUoMLIIChqKiUH0vy/gCN3dPKaiAGIcIl16sv5yFtyhYgM1B0i8hVSFSzczVAyQgrmlqHhaRERUTzesTHqItwSBjzKNhaKDDp56VbBKXXhjAUGTDbutUVMQqwG2VIm+UJs0AtU0om1M1M7/IOg8qkCtcVKQlawexFgQcmYuKclycEQJM/EguBYEgFTQBexY0ASUGNAFBRjQBReVgqAAA5jBYZlEwBccAAAAASUVORK5CYII=");
          resizer.addIconByURL("data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAIjSURBVHjanJFfSFNRHMe/9+xud/+62ubmYIEFoZUpvrQ99JD1HFFvPQVhZVIo5KugElTkSKOoDAZB4EsP1WtQFBixF4shtWkMi4bztpzuunvddPd0znSVeQ3yB18u5/7O9/P7nnMESim2qgej0XabJPXX+evb3bKMxYUcctnsh1KxOHixs+MZ3yNsBRgeuXthf0vraEPTAVBiQXWfBQa+TiWQmko+YpCzpoC+voHDR44dHd/d3IZCcWVT3ymJSE3GMfN5+hT5uykIgrTT6xnY29y6wWywQYt6CT+WlvFdXUbTwRYQQvpFk/RefyAY0o3fP7hRUXWIFgKHTYRQLkMrUwiSq80M4MzldZka9Jc5k9dYbCtqnRJkuxWSaIGLrRfyDGoCIGllPs0mBYtasTLZxgzc7HPbUeOwVVIQCMgyADEBrIxPfIyVtAK00ip4ED69xr6WwOuSKpC0kkUsnnxtBtA9FhWRe48RkB0gAljktbM7mXiazLyK29EnWDWMwU3POBQZicxm5npnVQppRy16zp2GL+CDlRC42fMlZ9KIjj3HRDzR+e7p/Ycb7uD6jcjlcDjU663z4eSZbugF9dqn6dS+hl3BcL3fE5xjd/PlWzpW0pduvX8x9rZi4gm4bg4Nd7189YYqSpZeuXqHHjrecYm1A0x7mBrXv3wtVT2V9Gbm0InzXX9u+pd4yds1VwGN8cnEtsxcwvr5eGWY8vjP+inAAAnCYGlDtONUAAAAAElFTkSuQmCC");
          resizer.addIconByImage(document.getElementsByTagName("img")[0]);
      }, 1500);
*/
function Resizer(width, height) {
  this.width = width;
  this.height = height;
  this._loading = [];
  this.icons = [];

  for(var i = 2; i < arguments.length; i++) {
    if(arguments[i] instanceof HTMLImageElement || arguments[i] instanceof Image
       || arguments[i] instanceof HTMLCanvasElement)
      this.addIconByImage(arguments[i]);
    else if(arguments[i] instanceof Ci.nsIURI)
      this.addIconByURL(arguments[i].spec);
    else
      this.addIconByURL(arguments[i]);
  }
}
Resizer.prototype = {
  width: 0,
  height: 0,
  __canvas: null,
  get _canvas() {
    if(!this.__canvas)
      this._createCanvas();
    return this.__canvas;
  },
  get _document() {
    if(this.__parent__.document)
      return this.__parent__.document;
    var mediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Ci.nsIWindowMediator);
    var win = mediator.getMostRecentWindow("navigator:browser");
    return win.document;
  },
  _createCanvas: function() {
    var canvas = this._document.createElementNS("http://www.w3.org/1999/xhtml",
                                                "canvas");
    canvas.setAttribute("width", this.width);
    canvas.setAttribute("height", this.height);
    this.__canvas = canvas.getContext("2d");
  },
  onload: null,

  get loaded() {
    return !this._loading.length;
  },
  _loading: null,

  _iconAdded: function(icon) {
    icon.squarePixels = (icon.naturalWidth * icon.naturalHeight);
    if(this.loaded && this.onload) {
      this.onload.call(this, icon);
    }
  },
  // moves the biggest (in height) image to the end as this may have doubled height in the end
  _reorder: function() {
    var icons = this.icons;
    if(icons.length < 2)
      return;

    var biggest = icons.length - 1; // pick one
    for(var i = 0; i < icons.length - 1; i++) {
      if(icons[i].height > icons[biggest].height ||
         (icons[i].height == icons[biggest].height && icons[i].width <= icons[biggest].width)) {
        biggest = i;
      }
    }
    if(biggest + 1 != icons.length) {
      var image = icons[biggest];
      this.icons = icons.slice(0, biggest).concat(icons.slice(biggest + 1))
      this.icons.push(image);
    }
  },

  _addLoadingIcon: function(img) {
    this._loading.push(img);
    var This = this;
    img.addEventListener("load", function() {
      This.icons.push(img);
      var idx = This._loading.indexOf(img);
      if(idx != -1) {
        This._loading = This._loading.slice(0, idx)
                                     .concat(This._loading.slice(idx + 1));
      }
      This._iconAdded(img);
    }, false);
  },
  addIconByURL: function(url) {
    var img = new this._document.defaultView.Image();
    this._addLoadingIcon(img);
    img.src = url;
  },
  removeIconByURL: function(url) {
    for(var i = this.icons.length; i > -1; i--) {
      if(this.icons[i].src == url)
        this.removeIconByImage(this.icons[i]);
    }
  },
  addIconByImage: function(img) {
    if(!img.naturalWidth && !img.naturalHeight) { // not loaded yet
      this._addLoadingIcon(img);
    } else {
      this.icons.push(img);
      this._iconAdded(img);
    }
  },
  removeIconByImage: function(img) {
    var idx;
    while((idx = this.icons.indexOf(img)) != -1)
      this.icons.splice(idx, 1);
  },

  paintIcons: function() {
    var canvas = this._canvas;
    canvas.fillStyle = canvas.strokeStyle = "rgba(0,0,0,0)"; // transparent
    canvas.clearRect(0, 0, this.width, this.height);
    var num = this.icons.length;
    if(!num) return;
    var height = Math.floor(this.height / 2);
    var width = (this.width * this.height) / ((num + (num % 2)) * height);

    if(num % 2)
      this._reorder();

    for(var i = 0; i + 1 < num; i++) {
      canvas.drawImage(this.icons[i], Math.floor(i / 2) * width,
                       (i % 2) * height, width, height);
    }

    // draw the last icon in doubled height if necessary
    canvas.drawImage(this.icons[i], Math.floor(i / 2) * width, (i % 2) * height,
                     width, height * ((num % 2) + 1));
  },
  getDataURL: function() {
    return this._canvas.canvas.toDataURL();
  }
};
