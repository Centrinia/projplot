/* projplot.js */

"use strict";

var FRAME_INTERVAL = 1000.0 / 30;
var DECIMAL_PLACES = 3;

var TOKENS = {
    'MINUS': {
        'regex': '(-|\\+-)'
    },
    'PLUS': {
        'regex': '\\+'
    },
    'TIMES': {
        'regex': '\\*'
    },
    'POWER': {
        'regex': '\\^'
    },
    'SYMBOL': {
        'regex': '\\w'
    },
    'LPAREN': {
        'regex': '\\('
    },
    'RPAREN': {
        'regex': '\\)'
    },
    'EQUALS': {
        'regex': '='
    },
    'REAL': {
        'regex': '\\d+(\\.\\d+)?(e(\\+|-)?\\d+)?'
    },
    'SPACES': {
        'regex': '\\s+'
    },
};

var GRAMMAR = {
    'SPACES': {
        'type': 'IGNORE',
    },
    'REAL': {
        'type': 'VALUE',
    },
    'SYMBOL': {
        'type': 'VALUE',
    },
    'PLUS': {
        'precedence': 1,
        'associativity': 'LEFT',
        'type': 'OPERATOR'
    },
    'MINUS': {
        'precedence': 1,
        'associativity': 'LEFT',
        'type': 'OPERATOR'
    },
    'TIMES': {
        'precedence': 2,
        'associativity': 'LEFT',
        'type': 'OPERATOR'
    },
    'POWER': {
        'precedence': 3,
        'associativity': 'RIGHT',
        'type': 'OPERATOR'
    },
    'LPAREN': {
        'precedence': 4,
        'bracket': 'LEFT',
        'type': 'BRACKET'
    },
    'RPAREN': {
        'precedence': 4,
        'bracket': 'RIGHT',
        'type': 'BRACKET'
    },
    'EQUALS': {
        'precedence': 0,
        'associativity': 'LEFT',
        'type': 'OPERATOR'
    },
};

if(!Array.prototype.last) {
    Array.prototype.last = function() {
        return this[this.length - 1];
    }
};

var Lexer = function(tokens) {
    this.tokens = tokens;
};

/**
 * Find a token at the start of the string.
 */
Lexer.prototype.find = function(str) {
    for(var token in this.tokens) {
        var re = new RegExp('^' + this.tokens[token]['regex']);
        if(re.test(str)) {
            var result = re.exec(str);
            var m = result[0];
            return {
                'token': token,
                'match': m,
                'remain': str.slice(result.index+m.length)
            };
        }
    }
    return null;
};

/**
 * Construct a list of tokens from the string.
 */
Lexer.prototype.lex = function (str) {
    var result = [ ];
    while(str.length > 0) {
        var m = this.find(str);
        if(m) {
            result.push({
                'token': m['token'],
                'match': m['match']
            });
            str = m['remain'];
        } else {
            return null;
        }
    }
    return result;
};



var PostfixParser = function(grammar) {
    this.grammar = grammar;
};

PostfixParser.prototype.parse = function(tokens) {
    var stack = [];
    var output = [];
    var grammar = this.grammar;
    // The shunting yard algorithm.
    var g = function(token) {
        return grammar[token['token']];
    }
    tokens.forEach(function(token) {
        if(g(token)['type'] == 'VALUE') {
            output.push(token);
        } else if(g(token)['type'] == 'OPERATOR') {
            var o1 = token;
            while(stack.length > 0) {
                var o2 = stack[stack.length - 1];
                if(g(o2)['type'] == 'OPERATOR' && 
                    ((g(o1)['associativity'] == 'LEFT' && g(o1)['precedence'] <= g(o2)['precedence']) ||
                    (g(o1)['associativity'] == 'RIGHT' && g(o1)['precedence'] < g(o2)['precedence']))) {
                    output.push(stack.pop());
                } else {
                    break;
                }
            }
            stack.push(o1);
        } else if(g(token)['type'] == 'BRACKET') {
            if(g(token)['bracket'] == 'LEFT') {
                stack.push(token);
            } else if(g(token)['bracket'] == 'RIGHT') {
                while(stack.length > 0 && 
                    !(g(stack[stack.length-1])['type'] == 'BRACKET' && g(stack[stack.length-1])['bracket'] == 'LEFT')
                ) {
                    output.push(stack.pop());
                }
                if(stack.length > 0) {
                    stack.pop();
                } else {
                    console.log('Mismatched brackets');
                }
            }
        }
    });
    while(stack.length > 0) {
        if(g(stack[stack.length - 1])['type'] == 'BRACKET') {
            console.log('Mismatched brackets');
            return null;
        }
        output.push(stack.pop());
    }
    return output;
};

PostfixParser.prototype.juxtaposeMultiply = function(tokens,multiplyToken) {
    var output = [];
    var grammar = this.grammar;
    var g = function(token) {
        return grammar[token['token']];
    }
    for(var i=0;i<tokens.length;i++) {
        output.push(tokens[i]);
        if(i < tokens.length-1 && g(tokens[i])['type'] == 'VALUE' && g(tokens[i+1])['type'] == 'VALUE') {
            output.push(multiplyToken);
        }
    }
    return output;
};
function getMousecoord(event) {
    var elem = event.target || event.srcElement;
    var rect = elem.getBoundingClientRect();
    return [2*(event.clientX - rect.left) / elem.width-1,
        1-2*(event.clientY - rect.top) / elem.height];
}

function vectorDivide(a, b) {
    var c = [0,0,0,0];
    c[0] = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    c[1] = a[2] * b[1] - a[1] * b[2];
    c[2] = a[0] * b[2] - a[2] * b[0];
    c[3] = a[1] * b[0] - a[0] * b[1];
    return c;
}

function cross(a, b) {
    var c = [0,0,0];
    c[0] = a[1] * b[2] - a[2] * b[1];
    c[1] = - (a[0] * b[2] - a[2] * b[0]);
    c[2] = a[0] * b[1] - a[1] * b[0];
    
    return c;
}
function quaternionApply(q, v) {
// v +  2.0 * cross(cross(v, q.xyz) + q.w * v, q.xyz);
    return add(v, scale(2, 
        cross(
            add(cross(v, q.slice(1)), scale(q[0], v)),
            q.slice(1)
            )
        ));
}
function norm(a) {
    var n = 0;
    for(var i=0;i<a.length;i++) {
        n += a[i] * a[i];
    }
    return Math.sqrt(n);
}
function quaternionInverse(a) {
    var c = a.slice(0);
    var n = dot(a,a);
    c = scale(-1/(n*n), c);
    c[0] = -c[0];
    return c;
}
/* The basis vectors of quaternions are [1, e3*e2, e1*e3, e2*e1] = [1, -e3*e2,e1*e3, -e2*e1] */
function quaternionMultiply(a, b) {
    var c = [0,0,0,0];

    c[0] = a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3];
    c[1] = a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2];
    c[2] = a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1];
    c[3] = a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0];
    return c;
}

function dot(a,b) {
    var c = 0;
    for(var i = 0; i < a.length; i++) {
        c += a[i] * b[i];
    }
    return c;
}
function scale(a,b) {
    var c = [];
    for(var i = 0; i < b.length; i++) {
        c[i] = a * b[i];
    }
    return c;
}
function add(a,b) {
    var c = [];
    for(var i = 0; i < a.length; i++) {
        c[i] = a[i] + b[i];
    }
    return c;
}
function sub(a,b) {
    var c = [];
    for(var i = 0; i < a.length; i++) {
        c[i] = a[i] - b[i];
    }
    return c;
}
function normalize(v) {
    var n = 0.0;
    var y = v.slice(0);
    for(var i=0;i<v.length;i++) {
        n += v[i] * v[i];
    }
    
    if(n > 0.0) {
        n = Math.sqrt(n);
        for(var i=0;i<v.length;i++) {
            y[i] /= n;
        }
    }
    return y;
}
function getShader(gl, id, str2) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = '';
    var k = shaderScript.firstChild;
    if(str2) {
        str += str2;
    }
    while (k) {
        if (k.nodeType == 3)
            str += k.textContent;
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }
    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

window.onload = function () {
    var canvas = document.getElementById('canvas');
    var gl = canvas.getContext('webgl');

	//var fragmentShader = getShader(gl, 'shader-fragment');
    var init_gl = function (fs_name, function_body) {
        var fs_prologue = 'precision mediump float;\n';
        if(function_body) {
            fs_prologue += function_body + '\n';
        }
        var fragmentShader = getShader(gl, fs_name, fs_prologue);
        var vertexShader = getShader(gl, 'shader-vertex');
        var shaderProgram = gl.createProgram();

        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        gl.useProgram(shaderProgram);


        /* Draw a screen-filling rectangle. */
        var positionArray = [
            /* Upper right triangle */
            -1,-1,
            1,-1,
            1,1,
            /* Lower left triangle */
            -1,-1,
            1,1,
            -1,1
            ];
        var positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionArray), gl.STATIC_DRAW);

        shaderProgram.u_displacement = gl.getUniformLocation(shaderProgram, 'u_displacement');
        shaderProgram.u_rotation = gl.getUniformLocation(shaderProgram, 'u_rotation');
        shaderProgram.u_radius = gl.getUniformLocation(shaderProgram, 'u_radius');
        shaderProgram.u_center = gl.getUniformLocation(shaderProgram, 'u_center');
        shaderProgram.a_position = gl.getAttribLocation(shaderProgram, 'a_position');
        gl.enableVertexAttribArray(shaderProgram.a_position);
        gl.vertexAttribPointer(shaderProgram.a_position, 2, gl.FLOAT, false, 0, 0);

        gl.uniform4fv(shaderProgram.u_rotation, rotQuat(rotationQuaternion));
        gl.uniform1f(shaderProgram.u_displacement, u_displacement);
        gl.uniform1f(shaderProgram.u_radius, sphereRadius);
        gl.uniform3fv(shaderProgram.u_center, sphereCenter);

        printCoordinateChange(rotationQuaternion);

        return shaderProgram;
    };
    var printCoordinateChange = function(quat) {
        var vars = ['x','y','z'];
        var str = '<p>';
        /* The accuracy of the coefficient display. */
        for(var i=0;i<3;i++) {
            var substr = vars[i] + '\' = ';
            var p = [0,0,0];
            p[i] = 1;
            var q = quaternionApply(quaternionInverse(quat), p);
            for(var j=0;j<3;j++) {
                q[j] = q[j].toFixed(DECIMAL_PLACES);
            }
            var firstElement = true;
            for(var j=0;j<3;j++) {
                var t;
                if(q[j] < 0) {
                    if(firstElement) {
                        substr += '-';
                    } else {
                        substr += ' - ';
                    }
                } else if(!firstElement && q[j] != 0) {
                    substr += ' + ';
                }
                if(q[j] != 0) {
                    var t = Math.abs(q[j]);
                    if(t == 1) {
                        substr += vars[j];
                    } else {
                        substr += t.toString() + '*' + vars[j];
                    }
                    firstElement = false;
                }
            }
            str += substr + '<br/>\n';
        }
        str += '</p>';
        quatSpan.innerHTML = str;
    };

    var rotQuat = function(q) {
        return [q[1], q[2], q[3], q[0]];
    };
    //var rotationQuaternion = [0,0,0,1];
    var rotationQuaternion = [1,0,0,0];
    var u_displacement = 3.0;

    var sphereCenter = [0,0,0];
    var sphereRadius = 1.0;

    var quatSpan = document.getElementById('quat');
    printCoordinateChange(rotationQuaternion);

    var showQuaternion = function (q) {
        return q;
    };

    var getEquation = function() {
        var prologue = 'float f(vec3 p) {\n\treturn ';
        var epilogue = ';\n}\n';
        var body = prologue + equationOption[equationOption.selectedIndex].value + epilogue;
        return body;
    };
    var equationOption = document.getElementById('equation');
    var modeButton = document.getElementById('mode-button');
    equationOption.onchange = function (event) {
        var fs_name;
        if(modeButton.innerHTML.trim() == 'Projective') {
            fs_name = 'shader-fragment';
        } else {
            fs_name = 'shader-fragment-affine';
        }
        shader = init_gl(fs_name,getEquation());
        queueRedraw();
    };

    var shader;
    if(modeButton.innerHTML.trim() == 'Projective') {
        shader = init_gl('shader-fragment', getEquation());
    } else {
        shader = init_gl('shader-fragment-affine',getEquation());
    }
    var redrawing = false;
    var redraw = function() {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    var queueRedraw = function() {
        if(!redrawing) {
            redrawing = true;
            window.setTimeout(function() {
                redraw();
                redrawing = false;
            }, FRAME_INTERVAL);
        }
    };

    var locationSpan = document.getElementById('cursor-location');
    


    queueRedraw();


    /* Find the intersection between the sphere and the view vector at the given pixel coordinates. */
    var intersectSphere = function(coords) {
        var p1 = [coords[0], coords[1], 0];
        var p0 = [0,0, u_displacement];
        var d = sub(p1, p0);
        var a = dot(d, d);
        var b = 2*dot(sub(p0, sphereCenter), d);
        var c = dot(sub(p0, sphereCenter), sub(p0, sphereCenter)) - sphereRadius*sphereRadius;
        var disc = b*b-4*a*c;

        if(disc >= 0) {
            var t0 = -b / (2*a);
            var t1 = Math.abs(Math.sqrt(disc) / (2*a));
            var t = t0-t1;
            var p = add(scale(t, d), p0);
            return p;
        } else {
            return null;
        }
    };
    var makeVector = function(coords) {
        if(modeButton.innerHTML.trim() == 'Projective') {
            return intersectSphere(coords);
        } else {
            return [coords[0], coords[1], 1/u_displacement];
        }
    }
    var printCursorLocation = function(quat,p) {
        var str;
        if(p) {
            var q = quaternionApply(quat, p);
            str = '[ ';
            var t = 1;
            for(var i=q.length-1;i>=0;i--) {
                if(q[i].toFixed(DECIMAL_PLACES) != 0.0) {
                    t = q[i];
                    break;
                }
            }
            for(i=0;i<q.length;i++) {
                var qi = (q[i] / t).toFixed(DECIMAL_PLACES);
                str += qi.toString();
                if(i < q.length-1) {
                    str += ' : ';
                } else {
                    str += ' ]';
                }
            }
        } else {
            str = '';
        }
        locationSpan.innerHTML = str;
    };
    var previousVector = null;
    var printingCoordinateChange = false;
    var onmove = function(coords) {
        var p = makeVector(coords);
        if(p) {
            p = sub(p, sphereCenter);

            var p1 = normalize(add(p,previousVector));
            var deltaQuaternion = vectorDivide(p1, previousVector);
            rotationQuaternion = quaternionMultiply(deltaQuaternion, rotationQuaternion);
            rotationQuaternion = normalize(rotationQuaternion);

            gl.uniform4fv(shader.u_rotation, rotQuat(rotationQuaternion));
            if(!printingCoordinateChange) {
                printingCoordinateChange = true;
                window.setTimeout(function() {
                    printCoordinateChange(rotationQuaternion);
                    printingCoordinateChange = false;
                }, FRAME_INTERVAL);
            }

            queueRedraw();

            previousVector = p;
        } else {
            previousVector = null;
        }
        event.preventDefault();
    }
	canvas.ontouchmove = function(event) {
        if(previousVector) {
            var coords = getMousecoord(event.touches[0]);

            onmove(coords);
        }
        event.preventDefault();
	};
    var printingCursorLocation = false;
	canvas.onmousemove = function(event) {
        var coords = getMousecoord(event);
        if(!printingCursorLocation) {
            printingCursorLocation = true;
            window.setTimeout(function () {
                if(printingCursorLocation) {
                    var p = makeVector(coords);
                    printCursorLocation(rotationQuaternion, p);
                    printingCursorLocation = false;
                }
            }, FRAME_INTERVAL);
        }
        if(previousVector) {
            onmove(coords);
        }
        event.preventDefault();
	};
	canvas.onmousewheel = function(event) {
		if(!event) {
			event = window.event;
		}

		var delta = 0;
		if(event.wheelDelta) {
			delta = event.wheelDelta/120;
		} else if(event.detail) {
			delta = event.detail/(-3);
		}
		var t = u_displacement * Math.pow(1.1,delta);
		if(1 < t && t < 200) {
			u_displacement = t;
		}

        gl.uniform1f(shader.u_displacement, u_displacement);
        queueRedraw();

		event.preventDefault();
	}

    canvas.ontouchend = function(event) {
        previousVector = null;
        printCursorLocation(rotationQuaternion, previousVector);
        event.preventDefault();
    };
    canvas.onmouseleave = function(event) {
        previousVector = null;
        printingCursorLocation = false;
        printCursorLocation(rotationQuaternion, previousVector);
        event.preventDefault();
    };
    canvas.ontouchcancel = function(event) {
        previousVector = null;
        printCursorLocation(rotationQuaternion, previousVector);
        event.preventDefault();
    };
    canvas.ontouchleave = function(event) {
        previousVector = null;
        printCursorLocation(rotationQuaternion, previousVector);
        event.preventDefault();
    };
    canvas.onmouseup = function(event) {
        previousVector = null;
        //printCursorLocation(rotationQuaternion, previousVector);
        event.preventDefault();
    };

    var ondown = function(coords) {
        previousVector = makeVector(coords);
        printCursorLocation(rotationQuaternion, previousVector);
        if(previousVector) {
            previousVector = sub(previousVector, sphereCenter);
        }
    };
    canvas.onmousedown = function(event) {
        var coords = getMousecoord(event);
        ondown(coords);
        event.preventDefault();
    };
    canvas.ontouchstart = function(event) {
        var coords = getMousecoord(event.touches[0]);
        ondown(coords);
        event.preventDefault();
    };
    var planeQuats = {
        'xy' : [1,0,0,0],
        'xz' : [1,0,1,0],
        'yz' : [1,1,1,1]
    };
    var planeOption = document.getElementById('plane');
    planeOption.onclick = function(event) {
        rotationQuaternion = normalize(planeQuats[planeOption[planeOption.selectedIndex].value]);
        gl.uniform4fv(shader.u_rotation, rotQuat(rotationQuaternion));
        printCoordinateChange(rotationQuaternion);
        queueRedraw();
    };
    planeOption.onclick(null);
    modeButton.onclick = function(event) {
        if(modeButton.innerHTML.trim() == 'Projective') {
            shader = init_gl('shader-fragment-affine',getEquation());
            queueRedraw();
            modeButton.innerHTML = 'Affine';
        } else {
            shader = init_gl('shader-fragment', getEquation());
            queueRedraw();
            modeButton.innerHTML = 'Projective';
        }
    };

    var equationText = document.getElementById('equation-text');
    equationText.onchange = function(event) {
        //console.log(equationText.value);
        var lex = new Lexer(TOKENS);
        var lexResult = lex.lex(equationText.value);
        if(lexResult) {
            console.log(lexResult);
        } else {
            window.alert('Can not lex.');
            console.log('Can not lex.');
        }
        var postfix = new PostfixParser(GRAMMAR);
        lexResult = postfix.juxtaposeMultiply(lexResult,
                {
                    'token': 'TIMES',
                    'match': '*'
                });
        console.log(lexResult);
        var postfixResult = postfix.parse(lexResult);
        if(postfixResult) {
            console.log(postfixResult);
        } else {
            window.alert('Can not parse.');
            console.log('Can not parse.');
        }
    };
};

