/* example usage:
      var resizer = new Resizer(100, 100);
      resizer.onload = function() {
        resizer.paintIcons();
        print(resizer.getDataURL());
      };
      resizer.addIconByURL("http://www.google.de/images/firefox/google.gif");
      resizer.addIconByURL("data:image/gif;base64,R0lGODlhCwALAIAAAAAA3pn/ZiH5BAEAAAEALAAAAAALAAsAAAIUhA+hkcuO4lmNVindo7qyrIXiGBYAOw==");
      window.setTimeout(function() {
        resizer.addIconByURL("http://www.google.de/images/firefox/google.gif");
        resizer.addIconByURL("data:image/gif;base64,R0lGODlhCwALAIAAAAAA3pn/ZiH5BAEAAAEALAAAAAALAAsAAAIUhA+hkcuO4lmNVindo7qyrIXiGBYAOw==");
      }, 1500);
*/
function Resizer(width, height) {
  this.width = width;
  this.height = height;

  this._createCanvas();

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

  this._loading = [];
}
Resizer.prototype = {
  width: 0,
  height: 0,
  _createCanvas: function() {
    var canvas = document.createElementNS("http://www.w3.org/1999/xhtml",
                                          "canvas");
    canvas.setAttribute("width", this.width);
    canvas.setAttribute("height", this.height);
    document.appendChild(canvas);
    this._canvas = canvas.getContext("2d");
  },
  onload: null,

  get loaded() {
    return this._loading.length != 0;
  },
  _loading: null,

  iconAdded: function(icon) {
    icon.squarePixels = icon.naturalWidth * icon.naturalHeight;
    if(this.loaded && this.onload) {
      this.onload.call(this, icon);
    }
  },
  addIconByURL: function(url) {
    var img = new Image();
    this._loading.push(img);
    var This = this;
    img.onload = function() {
      This.icons.push(img);
      var idx = This._loading.indexOf(img);
      This._loading = This._loading.slice(0, idx).concat(This._loading.slice(idx + 1));
      This.iconAdded(img);
    };
    img.src = url;
  },
  removeIconByURL: function(url) {
    for(var i = 0; i < this.icons.length; ++i) {
      if(this.icons[i].src == url)
        return this.removeIconByImage(this.icons[i--]);
    }
    return false;
  },
  addIconByImage: function(img) {
    this.icons.push(img);
    this.iconAdded(img);
  },
  removeIconByImage: function(img) {
    var idx = this.icons.indexOf(img);
    if(idx == -1)
      return true;
    this.icons = this.icons.slice(0, idx).concat(this.icons.slice(idx + 1));
    return true;
  },

  paintIcons: function() {
    var halfWidth = Math.floor(this.width / 2);
    var halfHeight = Math.floor(this.height / 2);
    switch(this.icons.length) {
      case 1:
        this._canvas.drawImage(this.icons[0], 0, 0, this.width, this.height);
        break;
      case 2:
        if(this.width >= this.height) {
          this._canvas.drawImage(this.icons[0], 0, 0, halfWidth,
                                 this.height);
          this._canvas.drawImage(this.icons[1], halfWidth, 0,
                                 halfWidth, this.height);
        } else {
          this._canvas.drawImage(this.icons[0], 0, 0, this.width,
                                 halfHeight);
          this._canvas.drawImage(this.icons[1], 0, halfHeight,
                                 this.width, halfHeight);
        }
        break;
      case 3:
        var icons = [];
        var bigIcon = null;
        if(this.icons[0].squarePixels > this.icons[1].squarePixels) {
          bigIcon = this.icons[0];
          icons.push(this.icons[1]);
        } else {
          bigIcon = this.icons[1];
          icons.push(this.icons[0]);
        }
        if(this.icons[2].squarePixels > this.icons[0].squarePixels) {
          icons.push(bigIcon);
          bigIcon = this.icons[2];
        } else {
          icons.push(this.icons[2]);
        }

        this._canvas.drawImage(bigIcon, 0, 0, halfWidth,
                               this.height);
        this._canvas.drawImage(icons[0], halfWidth, 0,
                               halfWidth,
                               halfHeight);
        this._canvas.drawImage(icons[1], halfWidth,
                               halfHeight,
                               halfWidth,
                               halfHeight);
        break;
      case 4:
      default:
        this._canvas.drawImage(this.icons[0], 0, 0, halfWidth,
                               halfHeight);
        this._canvas.drawImage(this.icons[1], halfHeight, 0,
                               halfWidth,
                               halfHeight);
        this._canvas.drawImage(this.icons[2], 0, halfHeight,
                               halfWidth,
                               halfHeight);
        this._canvas.drawImage(this.icons[3], halfWidth,
                               halfHeight, halfWidth,
                               halfHeight);
        break;
    }
  },
  getDataURL: function() {
    return this._canvas.canvas.toDataURL();
  }
};
