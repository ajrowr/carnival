
/* This is a mixin suite intended to be used by scenes. */
/* eg in your scene, do things like:  */
/* MyScene.prototype.addContent = FCFeedTools.addContent */

/* Content interpreters consume content input and format them into something we can use. */
/* Output format: {
        dest: 
        description:
        descriptionBlocks: (text blocks for description)
        caption: (not used yet)
        title: 
        type: [text|image] *
        src: (for images)
        text: (for text boards)
        textBlocks: (textblocks for text boards)
        meta_orig: stash point for original obect metadata, mainly for debugging
    }
*/


var _looksyplugin = function () {
    return {
        name: 'Looksy',
        detect: function (url) {
            return url.startsWith('http://meta4.io.codex.cx');
        },
        fetch: function (url) {
            
        },
        interpret: function (dat) {
            console.log(dat);
            var boardsDat = [];
            if (dat.groups) {
                for (var i=0; i<dat.groups.length; i++) {
                    var myGroup = dat.groups[i];
                    boardsDat.push({
                        type: 'image',
                        src: myGroup.cover,
                        caption: 'SET', /* not supported yet */
                        dest: myGroup.rootrel,
                        meta_orig: myGroup,
                        description: myGroup.title
                        // descriptionBlocks: descr.blocks
                    });
                }
            }
            if (dat.pics) {
                for (var i=0; i<dat.pics.length; i++) {
                    var myPic = dat.pics[i];
                    boardsDat.push({
                        type: 'image', 
                        src: myPic.url,
                        meta_orig: myPic,
                        dest: null,
                        description: myPic.rel
                    });
                }
            }
            return boardsDat;
        }
    }
}

var _modiaplugin = function () {
    return {
        name: 'Modia',
        detect: function (url) {
            return url.endsWith('.json');
        },
        fetch: function (url) {
            
        },
        interpret: function (dat) {
            console.log(dat);
            var boardsDat = [];
            if (dat.groups) {
                for (var i=0; i<dat.groups.length; i++) {
                    var myGroup = dat.groups[i];
                    boardsDat.push({
                        type: 'image',
                        src: myGroup.cover,
                        caption: 'SET', /* not supported yet */
                        dest: myGroup.rootrel,
                        meta_orig: myGroup,
                        description: myGroup.title
                        // descriptionBlocks: descr.blocks
                    });
                }
            }
            if (dat.pics) {
                for (var i=0; i<dat.pics.length; i++) {
                    var myPic = dat.pics[i];
                    boardsDat.push({
                        type: 'image', 
                        src: myPic.url,
                        meta_orig: myPic,
                        dest: null,
                        description: myPic.rel
                    });
                }
            }
            return boardsDat;
        }
    }
}

var _domaiplugin = function () {
    return {
        name: 'Domai',
        detect: function (url) {
            return url.startsWith('http://domai.io.codex.cx');
        },
        fetch: function (url) {
        
        },
        interpret: function (dat) {
            var boardsDat = [];

            var mkDescription = function (inf) {
                var descr;
                var dBlocks = [];
                try {
                    if (inf.rootrel) {

                        var l1, l2, l3;
                        l1 = inf.rootrel.split('/');
                        l2 = l1[1].split('_');
                        l3 = l2[2].split('-');

                        var inf;
                        if (l3[0] == l3[3]) inf = {
                            title: l3[0] + ' ' + l3[1] + ' ' + l3[2],
                            byLine: 'by ' + l3.splice(6).join(' ')
                        };
                        else inf = {
                            title: l3[0] + ' ' + l3[1],
                            byLine: 'by ' + l3.splice(4).join(' ')
                        }
                        inf.src = l2[0];
                        inf.when = l2[1];
                        inf.id = l2[3];

                        descr = [
                            inf.title, inf.byLine, inf.src + ' ' + inf.when, 'ID: ' + inf.id
                        ].join('\n');
                        dBlocks.push(
                            {t: inf.title, size: 50, font: 'georgia', color: 'black'},
                            {t: inf.byLine, size: 30, font: 'arial', color: 'black'},
                            {t: inf.src + ' ' + inf.when, size: 30, font: 'arial', color: 'black'},
                            {t: 'ID: ' + inf.id, size: 20, font: 'arial', color: 'black'}
                        );
                    }
                }
                catch (err) {
                    descr = 'No info available';
                    dBlocks = [{t:descr}];
                    console.log(err);
                }

                return {
                    text: descr,
                    blocks: dBlocks
                };
            }

            for (var i=0; i<dat.groups.length; i++) {
                var myGroup = dat.groups[i];
                boardsDat.push({
                    type: 'text',
                    text: myGroup.rootrel,
                    dest: myGroup.base,
                    meta_orig: myGroup
                });
            }
            for (var i=0; i<dat.sets.length; i++) {
                var mySet = dat.sets[i];
                var descr = mkDescription(mySet);
                boardsDat.push({
                    type: 'image',
                    src: mySet.cover.replace('_th/', ''), /* DIRTY HACK */
                    caption: 'SET', /* not supported yet */
                    dest: mySet.base,
                    meta_orig: mySet,
                    description: descr.text,
                    descriptionBlocks: descr.blocks
                });

            }
            for (var i=0; i<dat.pics.length; i++) {
                var myPic = dat.pics[i];
                boardsDat.push({
                    type: 'image',
                    src: myPic.src,
                    caption: 'PIC', /* not supported yet */
                    dest: null,
                    meta_orig: myPic
                });

            }
            return boardsDat;
        
        }
    }
}

var _tumblrplugin = function () {
    return {
        name: 'Tumblr',
        detect: function (url) {
            return url.includes('.tumblr.com');
        },
        fetch: function (url) {
        
        },
        interpret: function (dat) {
            var posts = dat.response.posts;
            var boardsdat = [];
            for (var i=0; i<posts.length; i++) {
                if (posts[i].photos) {
                    var p = posts[i];
                    for (var j=0; j<p.photos.length; j++) {
                        var ph = p.photos[j].original_size;
                        boardsdat.push({
                            type: 'image',
                            src: 'http://crossorigin.me/'+ph.url,
                            meta_orig: p,
                            description: 'Via ' + p.blog_name + '\nWhen: ' + p.date + '\n' + p.summary
                        });
                    }
                }
            }
        
            return boardsdat;
        }
    }
};



window.FCFeedTools = (function () {
    
    function CylinderArranger(params) {
        params = params || {};
        this.boardDistance = params.boardDistance || 4.5;
        this.perRow = params.perRow || 10;
        this.rowHeight = params.rowHeight || 3.1;
        this.boardHeight = params.boardHeight || 3.0;
        
    }
    CylinderArranger.prototype.arrange = function (rangeStart, rangeEnd) {
        var anglePer = (Math.PI*2)/this.perRow;
        var currentRow = 0;
        var boardsOut = [];

        for (var i=rangeStart; i<rangeEnd; i++) {
            currentRow = Math.floor(i/this.perRow);
            var currentPos = i % this.perRow;
            var ang = currentPos * anglePer;

            var boardPos = {
                x:this.boardDistance*Math.cos(ang),
                z:this.boardDistance*Math.sin(ang),
                y:-2.5 + (this.rowHeight*currentRow)
            };
            var boardOrientation = {
                x:0,
                y: -1*(anglePer*i) + 1.5*Math.PI,
                z:0
            };
            var boardSize = {
                
            }; /* Currently ignored */
            boardsOut[i] = {pos: boardPos, ori: boardOrientation, size: boardSize};
        }
        return boardsOut;    
    }
    
    /* ContentWrangler expects the scene to have the following attributes: */
    /*      sceneBoards, selectedBoardIdx (?), ... */
    function ContentWrangler(scene, params) {
        this.scene = scene;
        params = params || {};
        
        this.contentUrl = null;
        this.contentHistory = [];
        this.contentParams = {
            maxCount: params.maxCount || 100,
            // perRow: params.perRow || 10,
            perLoadCycle: params.perLoadCycle || 20,
            initialLoadCycle: params.initialLoadCycle || 40,
            arranger: params.arranger || new CylinderArranger()
        }
        this.contentData = null;
        this.contentFeeder = null;
        this.contentState = {
            rangeStart: null,
            rangeEnd: null,
            rangeLimit: null
        };
        
        /* Plugins are functions that return a structure: {detect:, fetch:, interpret: } */
        this.contentPlugins = [
            _looksyplugin(),
            _modiaplugin(),
            _tumblrplugin()
        ];
        
    }
    
    
    /* Load the JSON, have it interpreted, and then request creation of image boards */
    ContentWrangler.prototype.loadContent = function (url, params, append) {
        /* Handles loading of different types of content; including nav hubs */
        var wrangler = this;
        var scene = wrangler.scene;
        params = params || wrangler.contentParams || {};
        return new Promise(function (resolve, reject) {
            console.debug('Requesting data from remote host');
            FCUtil.httpGetJSON(url)
            .then(function (dat) {
                var newContent;
                console.debug('Got data from remote host');
                for (var i=0; i<wrangler.contentPlugins.length; i++) {
                    var myPlugin = wrangler.contentPlugins[i];
                    if (myPlugin.detect(url)) {
                        console.log('Plugin', myPlugin.name, 'detected matching content')
                        newContent = myPlugin.interpret(dat);
                        break;
                    }
                }
                if (!newContent) {
                    console.log('Content could not be comprehended.');
                }
                console.log('Incorporating new content with length ', newContent.length);
                wrangler._incorporateContent(newContent, params, append)
                .then(function (boardsList) {
                    resolve(boardsList);
                });
                                
            });
            
        });
    }
    
    ContentWrangler.prototype._incorporateContent = function (contentDat, params, append) {
        var wrangler = this;
        var scene = wrangler.scene;
        return new Promise(function (resolve, reject) {
            var loadCount = Math.min(params.perLoadCycle, contentDat.length);
            if (append) {
                if (!wrangler.contentData) wrangler.contentData = [];
                wrangler.contentData = wrangler.contentData.concat(contentDat);
                var newRangeEnd = wrangler.contentState.rangeEnd + loadCount;
                wrangler.loadSceneBoards(params, {
                    rangeStart: wrangler.contentState.rangeEnd,
                    rangeEnd: newRangeEnd,
                    append: true
                })
                .then(function (boardsList) {
                    wrangler.contentState.rangeEnd = newRangeEnd;
                    resolve(boardsList);
                });
            }
            else {
                wrangler.contentData = contentDat;
                wrangler.loadSceneBoards(params, {
                    rangeStart: 0,
                    rangeEnd: loadCount,
                    append: false
                }).then(function (boardsList) {
                    wrangler.contentState.rangeStart = 0;
                    wrangler.contentState.rangeEnd = loadCount;
                    resolve(boardsList);
                });
            }
            
        })
    }
    
    /* Open content from a given URL and add current content URL to history */
    ContentWrangler.prototype.openContent = function (url) {
        var wrangler = this;
        var scene = wrangler.scene;
        if (wrangler.contentUrl) {
            wrangler.contentHistory.push(wrangler.contentUrl);
        }
        wrangler.contentUrl = url;
        return wrangler.loadContent(url, wrangler.contentParams);
    }
    
    /* Close the current content and pop the previous content off the stack */
    ContentWrangler.prototype.closeContent = function () {
        var wrangler = this;
        var scene = wrangler.scene;
        if (wrangler.contentHistory.length) {
            var prevUrl = wrangler.contentHistory.pop();
        }
        wrangler.contentUrl = prevUrl;
        return wrangler.loadContent(prevUrl, wrangler.contentParams);
    }
    
    /* Like openContent() except that if the scene is not rendering yet, it just sets the content */
    /* TODO the merit of this is questionable */
    ContentWrangler.prototype.useContent = function (url) {
        var wrangler = this;
        var scene = wrangler.scene;
        if (scene.isRendering) {
            wrangler.openContent(url)
            .then(function (boards) {
                console.log('Loaded ' + boards.length + ' boards from ' + url);
            });
        }
        else {
            wrangler.contentUrl = url;
        }
    }
    
    ContentWrangler.prototype.addContent = function (url) {
        var wrangler = this;
        var scene = wrangler.scene;
        return wrangler.loadContent(url, null, true);
    }
    
    /* If the content is exhausted and a feed is defined, the feeder will be used */
    ContentWrangler.prototype.setContentFeed = function (url) {
        var wrangler = this;
        var scene = wrangler.scene;
        var mkContentFeeder = function (feedUrl, chunkSize, initial) {
            var offset = initial || 0;
            var feeder = function () {
                var nextChunk = feedUrl + '&offset=' + offset;
                offset += chunkSize;
                return nextChunk;
            }
            return feeder;
        }
        wrangler.contentFeeder = mkContentFeeder(url, 20);
        if (wrangler.contentData == null) {
            wrangler.contentData = [];
            wrangler.expandContentVisibleRange(20);
        }
    }
    
    ContentWrangler.prototype.addImages = function (sourceUrls, params) {
        var wrangler = this;
        var scene = wrangler.scene;
        params = params || wrangler.contentParams || {};
        var boardsDat = [];
        for (var i=0; i<sourceUrls.length; i++) {
            boardsDat.push({
                type: 'image',
                src: 'http://crossorigin.me/'+sourceUrls[i],
                meta_orig: {},
                description: 'No info available'
            });
            
        }
        return wrangler._incorporateContent(boardsDat, params, true);
        
    }
    
    
    ContentWrangler.prototype.dropBoards = function () {
        var wrangler = this;
        var scene = wrangler.scene;
        for (var i=0; i<scene.sceneBoards.length; i++) {
            scene.removeObject(scene.sceneBoards[i]);
            // scene.sceneBoards[i].destroy();
        }
        scene.sceneBoards = [];
        scene.selectedBoardIdx = null;
    }
    
    ContentWrangler.prototype.dropBoardsInRange = function (rangeStart, rangeEnd) {
        var wrangler = this;
        var scene = wrangler.scene;
        for (var i=rangeStart; i<rangeEnd; i++) {
            if (scene.sceneBoards[i]) {
                scene.removeObject(scene.sceneBoards[i]);
                scene.sceneBoards[i] = null;
            }
        }
    }
    
    ContentWrangler.prototype.setContentVisibleRange = function (rangeStart, rangeEnd) {
        var wrangler = this;
        var scene = wrangler.scene;
        var params = wrangler.contentParams || {};
        /* TODO drop boards outside range */
        /* TODO ignore boards already loaded */
        var rangeLoadStart = rangeStart;
        if (rangeStart < wrangler.contentState.rangeEnd) { /* TODO should this be <= ? */
            rangeLoadStart = wrangler.contentState.rangeEnd;
        }
        rangeEnd = Math.min(rangeEnd, wrangler.contentData.length);
        console.log('Requesting loadSceneBoards');
        wrangler.loadSceneBoards(params, {
            rangeStart: rangeLoadStart,
            rangeEnd: rangeEnd,
            append: true
        })
        .then(function (boards) {
            console.log('setContentVisibleRange reports resolve() from loadSceneBoards; rangeEnd:', rangeEnd, 'maxCount:', params.maxCount);
            if (rangeEnd - params.maxCount > 0) {
                rangeStart = rangeEnd - params.maxCount;
                wrangler.dropBoardsInRange(0, rangeStart);
            }
            wrangler.contentState.rangeStart = rangeStart;
            wrangler.contentState.rangeEnd = rangeEnd;
            console.log('Set visible range', rangeStart, '-', rangeEnd);
        });
    }
    
    ContentWrangler.prototype.expandContentVisibleRange = function (byCount) {
        var wrangler = this;
        var scene = wrangler.scene;
        byCount = byCount || wrangler.contentParams.perLoadCycle;
        var newRangeEnd = wrangler.contentState.rangeEnd + byCount;
        console.log('Displaying more content... up to', newRangeEnd, 'out of', wrangler.contentData.length);
        if ((newRangeEnd >= wrangler.contentData.length) && wrangler.contentFeeder) {
            console.log('Getting more content from content feeder...');
            wrangler.addContent(wrangler.contentFeeder())
            .then(function () {
                wrangler.setContentVisibleRange(0, newRangeEnd); /* Pretty much just for dropping oob boards */
            })
            // scene.setContentVisibleRange(0, newRangeEnd);
        }
        else {
            wrangler.setContentVisibleRange(0, newRangeEnd);
        }
    }
    
    /* Load boards internalised in the scene */
    /* params are scene params passed down through the stack and generally originating with the developer.
       params2 is for mechanical internals */
    ContentWrangler.prototype.loadSceneBoards = function (params, params2) {
        params2 = params2 || {};
        var wrangler = this;
        var scene = wrangler.scene;
        var startIdx = params2.rangeStart || 0, endIdx = params2.rangeEnd || wrangler.contentParams.maxCount;
        var append = params2.append || false;
        function mkSelecter(myScene) {
            var selecter = function (obj, params) {
                var cursor = myScene.getObjectByLabel('cursor');
                cursor.animateToPosition({x:obj.pos.x * 0.8, z:obj.pos.z * 0.8, y:obj.pos.y+0.3}, 700);
            }
            return selecter
        };
        
        return new Promise(function (resolve, reject) {
            FCUtil.loadBoardsFromContentData(scene, wrangler.contentData, params, params2)
            .then(function (boardsList) {
                if (!append) wrangler.dropBoards();
                for (var i=0; i<boardsList.length; i++) {
                    boardsList[i].interactions['select'] = mkSelecter(scene);
                    scene.addObject(boardsList[i]);
                }
                // scene.prepare();
                console.log('Appending', boardsList.length, 'items to sceneBoards');
                if (scene.sceneBoards.length + boardsList.length > wrangler.contentData.length) {
                    console.log('Something\'s gone wrong - sceneBoards would have too many items');
                }
                else {
                    scene.sceneBoards = scene.sceneBoards.concat(boardsList);
                }
                console.log('sceneBoards now has', scene.sceneBoards.length, 'items')
                resolve(boardsList);
            });
        });
    }
    
    
    return {
        ContentWrangler: ContentWrangler,
        CylinderArranger: CylinderArranger
    };
})();