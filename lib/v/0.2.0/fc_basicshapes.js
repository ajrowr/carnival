
window.FCBasicShapes = (function () {
    "use strict";
    var shapeTypes = {};
    
    var P = FCPrimitives;
    
    /* A planar shape made of a definable number of segments to support tiling textures */
    /* Define its dimensions with size={minX, maxX, minY, maxY} notation */
    var WallShape = function (pos, size, rotate, params) {
        P.Drawable.call(this, pos, size, rotate, params);
        var p = params || {};
        var sz = size || {};
        this.segmentsX = p.segmentsX || 10;
        this.segmentsY = p.segmentsY || 10;
        this.minX = sz.minX || 0;
        this.minY = sz.minY || 0;
        this.maxX = sz.maxX || 10;
        this.maxY = sz.maxY || 10;
        
    }
    WallShape.prototype = Object.create(P.Drawable.prototype);
    
    WallShape.prototype.divulge = function () {
        var poly = new P.Poly();
        poly.normal(0,0,1);
        
        var segSizeX = (this.maxX - this.minX)/this.segmentsX;
        var segSizeY = (this.maxY - this.minY)/this.segmentsY;
        for (var ix=0; ix<this.segmentsX; ix++) {
            for (var jy=0; jy<this.segmentsY; jy++) {
                var xlo = this.minX + (ix*segSizeX);
                var xhi = xlo + segSizeX;
                var ylo = this.minY + (jy*segSizeY);
                var yhi = ylo + segSizeY;
                var z = 0;
                var A = P.mkVert(xlo, ylo, z);
                var B = P.mkVert(xhi, ylo, z);
                var C = P.mkVert(xhi, yhi, z);
                var D = P.mkVert(xlo, yhi, z);
                poly.add(A, P.tex.bl, B, P.tex.br, C, P.tex.tr);
                poly.add(A, P.tex.bl, C, P.tex.tr, D, P.tex.tl);
            }
        }
        return {indices: poly.indices, vertices: poly.verts};
    }
    
    shapeTypes['WallShape'] = WallShape;
    
    
    /* Procedural cylinder, faces invertable, endcap optional (TODO), centered on given pos, texcoords distributed evenly */
    /* size = {radius:R, height:H} */
    /* params = {segmentCount:N, segmentsFaceInwards:[true|false]} */
    var CylinderShape = function (pos, size, rotate, params) {
        P.Drawable.call(this, pos, size, rotate, params);
        var p = params || {};
        var sz = size || {};
        this.segmentCount = p.segmentCount || 100;
        this.segmentsFaceInwards = p.segmentsFaceInwards || false;
        this.radius = sz.radius || 1;
        this.height = sz.height || 1;
    }
    CylinderShape.prototype = Object.create(P.Drawable.prototype);
    
    CylinderShape.prototype.divulge = function () {
        var poly = new P.Poly();
        
        var ylo = 0, yhi = this.height;
        var anglePer = (2*Math.PI)/this.segmentCount;
        var r = this.radius;
        var texincr = 1/this.segmentCount;
        for (var i=0; i<this.segmentCount; i++) {
            var xlo = Math.cos(anglePer*i)*r, xhi = Math.cos(anglePer*(i+1))*r;
            var zlo = Math.sin(anglePer*i)*r, zhi = Math.sin(anglePer*(i+1))*r;
            var A = P.mkVert(xlo, ylo, zlo);
            var B = P.mkVert(xhi, ylo, zhi);
            var C = P.mkVert(xhi, yhi, zhi);
            var D = P.mkVert(xlo, yhi, zlo);
            var texL = texincr * i, texR = texincr * (i+1);
            var bl = [texL,1], br = [texR, 1], tl = [texL, 0], tr = [texR,0];
            poly.normal(Math.cos(anglePer*(i+0.5)), 0, Math.sin(anglePer*(i+0.5)));
            if (this.segmentsFaceInwards) {
                poly.add(A, bl, B, br, C, tr);
                poly.add(A, bl, C, tr, D, tl);
            }
            else {
                poly.add(C, tr, B, br, A, bl);
                poly.add(D, tl, C, tr, A, bl);
                
            }
        }
        return {indices: poly.indices, vertices: poly.verts};
    }
    
    shapeTypes['CylinderShape'] = CylinderShape;
    
    
    return shapeTypes;
    
})();