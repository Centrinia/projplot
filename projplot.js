/* projplot.js */

"use strict";

var DECIMAL_PLACES=3;

function get_mousecoord(event) {
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
        shaderProgram.a_position = gl.getAttribLocation(shaderProgram, 'a_position');
        gl.enableVertexAttribArray(shaderProgram.a_position);
        gl.vertexAttribPointer(shaderProgram.a_position, 2, gl.FLOAT, false, 0, 0);

        gl.uniform4fv(shaderProgram.u_rotation, rotQuat(rotationQuaternion));
        gl.uniform1f(shaderProgram.u_displacement, u_displacement);

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
            var q = quaternionApply(quat, p);
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
    var rotationQuaternion = [0,0,0,1];
    var u_displacement = -3.0;


    var quatSpan = document.getElementById('quat');
    printCoordinateChange(rotationQuaternion);

    var showQuaternion = function (q) {
        return q;
    };

    var get_equation = function() {
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
        shader = init_gl(fs_name,get_equation());
        queue_redraw();
    };

    var shader;
    if(modeButton.innerHTML.trim() == 'Projective') {
        shader = init_gl('shader-fragment', get_equation());
    } else {
        shader = init_gl('shader-fragment-affine',get_equation());
    }
    var frame_interval = 1000.0 / 30;
    var redrawing = false;
    var redraw = function() {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    var queue_redraw = function() {
        if(!redrawing) {
            redrawing = true;
            window.setTimeout(function() {
                redraw();
                redrawing = false;
            }, frame_interval);
        }
    };

    var locationSpan = document.getElementById('cursor-location');
    
    queue_redraw();

    var sphere_center = [0,0,0];
    var sphere_radius = 1.0;
    /* Find the intersection between the sphere and the view vector at the given pixel coordinates. */
    var intersect_sphere = function(coords) {
        var p1 = [coords[0], coords[1], 0];
        var p0 = [0,0, u_displacement];
        var d = sub(p1, p0);
        var a = dot(d, d);
        var b = 2*dot(sub(p0, sphere_center), d);
        var c = dot(sub(p0, sphere_center), sub(p0, sphere_center)) - sphere_radius;
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
            return intersect_sphere(coords);
        } else {
            return [-coords[0]*u_displacement, -coords[1]*u_displacement, -1];
        }
    }
    var printCursorLocation = function(quat,p) {
        var str;
        if(p) {
            var q = quaternionApply(quat, p);
            str = '[ ';
            var t = 1;
            for(var i=q.length-1;i>=0;i--) {
                if(q[i] != 0.0) {
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
    var onmove = function(coords) {
        var p = makeVector(coords);
        printCursorLocation(rotationQuaternion, p);
        if(p) {
            p = sub(p, sphere_center);

            var p1 = normalize(add(p,previousVector));
            var deltaQuaternion = vectorDivide(p1, previousVector);
            rotationQuaternion = quaternionMultiply(deltaQuaternion, rotationQuaternion);
            rotationQuaternion = normalize(rotationQuaternion);

            gl.uniform4fv(shader.u_rotation, rotQuat(rotationQuaternion));
            printCoordinateChange(rotationQuaternion);

            queue_redraw();


            previousVector = p;
        } else {
            previousVector = null;
        }
        event.preventDefault();
    }
	canvas.ontouchmove = function(event) {
        if(previousVector) {
            var coords = get_mousecoord(event.touches[0]);

            onmove(coords);
        }
        event.preventDefault();
	};
	canvas.onmousemove = function(event) {
        if(previousVector) {
            var coords = get_mousecoord(event);

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
			delta = event.detail/-3;
		}
		var t = u_displacement * Math.pow(1.1,delta);
		if(1 < -t && -t < 150) {
			u_displacement = t;
		}

        gl.uniform1f(shader.u_displacement, u_displacement);
        queue_redraw();

		event.preventDefault();
	}

    canvas.ontouchend = function(event) {
        previousVector = null;
        printCursorLocation(rotationQuaternion, previousVector);
        event.preventDefault();
    };
    canvas.onmouseleave = function(event) {
        previousVector = null;
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
        printCursorLocation(rotationQuaternion, previousVector);
        event.preventDefault();
    };

    var ondown = function(coords) {
        previousVector = makeVector(coords);
        printCursorLocation(rotationQuaternion, previousVector);
        if(previousVector) {
            previousVector = sub(previousVector, sphere_center);
        }
    };
    canvas.onmousedown = function(event) {
        var coords = get_mousecoord(event);
        ondown(coords);
        event.preventDefault();
    };
    canvas.ontouchstart = function(event) {
        var coords = get_mousecoord(event.touches[0]);
        ondown(coords);
        event.preventDefault();
    };
    var planeQuats = {
        'xy' : [0,0,0,1],
        'xz' : [1,0,1,0],
        'yz' : [1,1,1,1]
    };
    var planeOption = document.getElementById('plane');
    planeOption.onclick = function(event) {
        rotationQuaternion = normalize(planeQuats[planeOption[planeOption.selectedIndex].value]);
        gl.uniform4fv(shader.u_rotation, rotQuat(rotationQuaternion));
        printCoordinateChange(rotationQuaternion);
        queue_redraw();
    };
    planeOption.onclick(null);
    modeButton.onclick = function(event) {
        if(modeButton.innerHTML.trim() == 'Projective') {
            shader = init_gl('shader-fragment-affine',get_equation());
            queue_redraw();
            modeButton.innerHTML = 'Affine';
        } else {
            shader = init_gl('shader-fragment', get_equation());
            queue_redraw();
            modeButton.innerHTML = 'Projective';
        }
    };

};

