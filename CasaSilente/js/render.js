'use strict';
/* SHADOWLINE - renderer: shader PBR, ombre della torcia, HDR + MSAA, bloom e color grading */
const Renderer = (function () {
  let gl, canvas, W = 640, H = 360, quality = 'high';
  const P = {};                       // programmi
  const Q = {
    low: { scale: 0.6, msaa: 0, shadow: 0, bloom: false, dpr: 1 },
    med: { scale: 0.8, msaa: 0, shadow: 512, bloom: true, dpr: 1 },
    high: { scale: 1.0, msaa: 4, shadow: 1024, bloom: true, dpr: 1 },
    ultra: { scale: 1.0, msaa: 4, shadow: 2048, bloom: true, dpr: 1.5 }
  };
  let T = {};                         // target
  let emptyVAO = null, shadowRT = null, dummyShadow = null;
  const view = M4.create(), proj = M4.create(), vp = M4.create(), projVM = M4.create(), vpVM = M4.create();
  const camWorld = M4.create(), lvp = M4.create(), lproj = M4.create(), lview = M4.create();
  const planes = new Float32Array(24);
  const cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fx: 1, fy: 0, fz: 0, rx: 0, ry: 0, rz: 1, ux: 0, uy: 1, uz: 0 };
  const dlPos = new Float32Array(32), dlCol = new Float32Array(32);
  let lastMat = null, curProg = null;

  /* ---------------- batch particelle ---------------- */
  function Batch(maxQuads) {
    this.data = new Float32Array(maxQuads * 4 * 9); this.n = 0; this.max = maxQuads * 4;
  }
  Batch.prototype.v = function (x, y, z, u, v, r, g, b, a) {
    if (this.n >= this.max) return;
    const o = this.n * 9, d = this.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = u; d[o + 4] = v; d[o + 5] = r; d[o + 6] = g; d[o + 7] = b; d[o + 8] = a;
    this.n++;
  };
  const Batches = { alpha: new Batch(2200), add: new Batch(1600), vmAdd: new Batch(40) };
  let partVAO, partVBO, partIBO;

  /* ---------------- shader ---------------- */
  const VS_UBER = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUV;
uniform mat4 uModel; uniform mat4 uVP; uniform mat3 uNM; uniform vec2 uUV;
out vec3 vPos; out vec3 vNrm; out vec2 vUV;
void main(){ vec4 wp=uModel*vec4(aPos,1.0); vPos=wp.xyz; vNrm=normalize(uNM*aNrm); vUV=aUV*uUV; gl_Position=uVP*wp; }`;

  const FS_UBER = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vPos; in vec3 vNrm; in vec2 vUV; out vec4 oColor;
uniform sampler2D uTex; uniform sampler2D uLM; uniform sampler2D uRM; uniform sampler2DShadow uShadow; uniform float uRoomK[64]; uniform float uRoomLit;
uniform vec3 uCam, uAlbedo, uEmissive, uAmbient, uFogCol, uTint;
uniform float uUseTex, uBump, uRough, uMetal, uRVar, uEmMode, uUnlit, uTrim, uWallH, uFogDens, uAlarm, uShadowOn, uShTexel, uFlOn;
uniform vec2 uLMInv;
uniform int uNDL; uniform vec4 uDLPos[8]; uniform vec4 uDLCol[8];
uniform vec4 uFLPos, uFLDir, uFLCol; uniform mat4 uFLVP;
const float PI=3.14159265;
float D_GGX(float NoH,float a){ float a2=a*a; float d=NoH*NoH*(a2-1.0)+1.0; return a2/(PI*d*d+1e-5); }
float G_S(float NoV,float NoL,float r){ float k=(r+1.0)*(r+1.0)/8.0; return (NoV/(NoV*(1.0-k)+k))*(NoL/(NoL*(1.0-k)+k)); }
vec3 lightBRDF(vec3 N,vec3 V,vec3 L,vec3 rad,vec3 diffC,vec3 F0,float rough){
  float NoL=max(dot(N,L),0.0); if(NoL<=0.0) return vec3(0.0);
  vec3 H=normalize(V+L); float NoV=max(dot(N,V),1e-3), NoH=max(dot(N,H),0.0), VoH=max(dot(V,H),0.0);
  float a=rough*rough; vec3 F=F0+(1.0-F0)*pow(1.0-VoH,5.0);
  vec3 spec=D_GGX(NoH,max(a,0.045))*G_S(NoV,NoL,rough)*F/(4.0*NoV*NoL+1e-3);
  return (diffC*(1.0-F)*NoL + spec*NoL)*rad;
}
vec3 envCol(vec3 R,float lum){
  float up=R.y*0.5+0.5;
  vec3 c=mix(vec3(0.02,0.022,0.027),vec3(0.20,0.22,0.26),smoothstep(0.15,1.0,up));
  float lamp=smoothstep(0.80,0.97,R.y)*(0.75+0.25*sin(R.x*37.0+R.z*29.0));
  c+=vec3(1.0,0.92,0.78)*lamp*1.1;
  return c*(0.22+lum*1.5);
}
float roomK(vec2 xz){ float id=texture(uRM,xz*uLMInv).r*255.0; return uRoomK[int(id+0.5)]; }
vec3 perturb(vec3 N,vec3 p,float h,float k){
  vec3 dpx=dFdx(p), dpy=dFdy(p); float dhx=dFdx(h), dhy=dFdy(h);
  vec3 r1=cross(dpy,N), r2=cross(N,dpx); float det=dot(dpx,r1);
  vec3 grad=sign(det)*(dhx*r1+dhy*r2);
  return normalize(abs(det)*N-k*grad);
}
float shadowPCF(vec3 wp){
  vec4 lp=uFLVP*vec4(wp,1.0); vec3 pc=lp.xyz/lp.w*0.5+0.5;
  if(pc.z>=1.0||pc.x<0.0||pc.x>1.0||pc.y<0.0||pc.y>1.0) return 1.0;
  float s=0.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) s+=texture(uShadow,vec3(pc.xy+vec2(float(x),float(y))*uShTexel,pc.z-0.0012));
  return s/9.0;
}
void main(){
  vec3 Ng=normalize(vNrm); if(!gl_FrontFacing) Ng=-Ng;
  vec4 t=uUseTex>0.5?texture(uTex,vUV):vec4(1.0,1.0,1.0,0.5);
  vec3 albedo=uAlbedo*t.rgb;
  float dist=length(uCam-vPos); vec3 V=(uCam-vPos)/max(dist,1e-4);
  if(uUnlit>0.5){
    vec3 c=albedo*uEmissive; if(uRoomLit>0.5) c*=roomK(vPos.xz); float f=1.0-exp(-uFogDens*dist); c=mix(c,uFogCol,f*0.9); oColor=vec4(c+uTint,1.0); return;
  }
  vec3 N=Ng;
  if(uBump>0.0) N=perturb(Ng,vPos,t.a,uBump*(1.0-smoothstep(5.0,14.0,dist)));
  float rough=clamp(uRough+uRVar*(t.a-0.5),0.06,1.0);
  if(uTrim>0.5){
    float y=vPos.y; float sk=1.0-smoothstep(0.085,0.10,y); float cor=smoothstep(uWallH-0.075,uWallH-0.06,y);
    float tm=max(sk,cor); albedo=mix(albedo,vec3(0.04,0.042,0.046),tm); rough=mix(rough,0.5,tm);
  }
  vec3 F0=mix(vec3(0.04),albedo,uMetal); vec3 diffC=albedo*(1.0-uMetal);
  vec4 l=texture(uLM,(vPos.xz+Ng.xz*0.32)*uLMInv);
  vec3 lm=l.rgb*2.0*roomK(vPos.xz+Ng.xz*0.32); float ao=l.a;
  float vao=1.0;
  if(uTrim>0.5) vao=mix(0.55,1.0,smoothstep(0.0,0.35,vPos.y))*mix(0.65,1.0,smoothstep(uWallH,uWallH-0.3,vPos.y));
  float lmLum=dot(lm,vec3(0.3333));
  float bs=clamp(1.0-(1.0-dot(N,Ng))*7.0,0.45,1.0);
  vec3 irr=uAmbient*ao*vao + lm*ao*vao*mix(1.0,bs,0.85);
  irr+=uAlarm*vec3(1.0,0.07,0.04)*0.55*(0.2+lmLum)*vao;
  vec3 col=diffC*irr;
  float NoV=max(dot(N,V),0.0);
  vec3 R=reflect(-V,N);
  vec3 Fe=F0+(max(vec3(1.0-rough),F0)-F0)*pow(1.0-NoV,5.0);
  col+=envCol(R,lmLum)*Fe*ao*vao*(0.25+0.75*smoothstep(0.0,0.3,lmLum));
  for(int i=0;i<8;i++){
    if(i>=uNDL) break;
    vec3 Lv=uDLPos[i].xyz-vPos; float d=length(Lv); float Rr=uDLPos[i].w; if(d>Rr) continue;
    vec3 L=Lv/d; float att=pow(clamp(1.0-pow(d/Rr,4.0),0.0,1.0),2.0)/(d*d+0.25);
    vec3 rad=uDLCol[i].rgb*att; float so=uDLCol[i].w;
    if(so>0.5){ rad*=smoothstep(0.05,0.35,lmLum); col+=lightBRDF(N,V,L,rad,vec3(0.0),F0,rough); }
    else col+=lightBRDF(N,V,L,rad,diffC,F0,rough);
  }
  if(uFlOn>0.5){
    vec3 Lv=uFLPos.xyz-vPos; float d=length(Lv); vec3 L=Lv/d;
    float cosA=dot(-L,uFLDir.xyz); float spot=smoothstep(uFLDir.w,uFLCol.w,cosA);
    if(spot>0.0&&d<24.0){
      float att=1.0/(1.0+d*d*0.05)*(1.0-smoothstep(15.0,24.0,d));
      float sh=1.0; if(uShadowOn>0.5) sh=shadowPCF(vPos+Ng*0.012);
      col+=lightBRDF(N,V,L,uFLCol.rgb*att*spot*sh*7.0,diffC,F0,rough);
    }
  }
  vec3 em=uEmissive;
  if(uEmMode>0.5){
    float mx=max(albedo.r,max(albedo.g,albedo.b)), mn=min(albedo.r,min(albedo.g,albedo.b)); float sat=(mx-mn)/(mx+1e-4);
    em=uEmissive*smoothstep(0.42,0.8,mx)*smoothstep(0.3,0.55,sat)*albedo/max(mx,1e-3);
  }
  col+=em+uTint;
  float f=1.0-exp(-uFogDens*dist); col=mix(col,uFogCol,f*0.9);
  oColor=vec4(col,1.0);
}`;

  const VS_SHADOW = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uModel; uniform mat4 uLVP;
void main(){ gl_Position=uLVP*uModel*vec4(aPos,1.0); }`;
  const FS_SHADOW = `#version 300 es
precision mediump float; out vec4 o; void main(){ o=vec4(0.0); }`;

  const VS_PART = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV; layout(location=2) in vec4 aCol;
uniform mat4 uVP; out vec2 vUV; out vec4 vCol;
void main(){ vUV=aUV; vCol=aCol; gl_Position=uVP*vec4(aPos,1.0); }`;
  const FS_PART = `#version 300 es
precision highp float; in vec2 vUV; in vec4 vCol; uniform sampler2D uAtlas; out vec4 o;
void main(){ vec4 t=texture(uAtlas,vUV); vec4 c=vCol*t; o=vec4(c.rgb*c.a,c.a); }`;

  const VS_FULL = `#version 300 es
out vec2 vUV;
void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); vUV=p; gl_Position=vec4(p*2.0-1.0,0.0,1.0); }`;
  const FS_BRIGHT = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThr; out vec4 o;
void main(){
  vec3 c=texture(uSrc,vUV+uTexel*vec2(-1.0,-1.0)).rgb+texture(uSrc,vUV+uTexel*vec2(1.0,-1.0)).rgb+texture(uSrc,vUV+uTexel*vec2(-1.0,1.0)).rgb+texture(uSrc,vUV+uTexel*vec2(1.0,1.0)).rgb;
  c*=0.25; float lum=max(max(c.r,c.g),c.b); float k=max(lum-uThr,0.0); k=k*k/(k+0.5); c*=k/max(lum,1e-4);
  o=vec4(min(c,vec3(30.0)),1.0);
}`;
  const FS_DOWN = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uSrc; uniform vec2 uTexel; out vec4 o;
void main(){
  vec3 c=texture(uSrc,vUV).rgb*4.0;
  c+=texture(uSrc,vUV+uTexel*vec2(-1.0,-1.0)).rgb+texture(uSrc,vUV+uTexel*vec2(1.0,-1.0)).rgb+texture(uSrc,vUV+uTexel*vec2(-1.0,1.0)).rgb+texture(uSrc,vUV+uTexel*vec2(1.0,1.0)).rgb;
  o=vec4(c/8.0,1.0);
}`;
  const FS_UP = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uSrc; uniform vec2 uTexel; out vec4 o;
void main(){
  vec3 c=texture(uSrc,vUV+uTexel*vec2(-1.0,0.0)).rgb+texture(uSrc,vUV+uTexel*vec2(1.0,0.0)).rgb+texture(uSrc,vUV+uTexel*vec2(0.0,-1.0)).rgb+texture(uSrc,vUV+uTexel*vec2(0.0,1.0)).rgb;
  c+=2.0*(texture(uSrc,vUV+uTexel*vec2(-0.5,-0.5)).rgb+texture(uSrc,vUV+uTexel*vec2(0.5,-0.5)).rgb+texture(uSrc,vUV+uTexel*vec2(-0.5,0.5)).rgb+texture(uSrc,vUV+uTexel*vec2(0.5,0.5)).rgb);
  o=vec4(c/12.0,1.0);
}`;
  const FS_COMP = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uScene; uniform sampler2D uBloom;
uniform float uGrain, uBloomStr, uExposure, uTime, uVign, uHurt, uLow, uFlashW, uAlarm; out vec4 o;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
float hash(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
void main(){
  vec2 c=vUV-0.5; float r2=dot(c,c);
  vec2 ca=c*r2*0.012;
  vec3 col=vec3(texture(uScene,vUV+ca).r,texture(uScene,vUV).g,texture(uScene,vUV-ca).b);
  col+=texture(uBloom,vUV).rgb*uBloomStr;
  col*=uExposure;
  float lum=dot(col,vec3(0.2126,0.7152,0.0722));
  // color grading cinematografico: ombre fredde, luci calde, leggero desaturato
  float sat=0.9-uLow*0.55;
  col=mix(vec3(lum),col,sat);
  col*=mix(vec3(0.93,1.0,1.07),vec3(1.07,1.0,0.9),smoothstep(0.02,0.5,lum));
  col=aces(col*1.05);
  col=pow(col,vec3(1.0/2.2));
  // contrasto morbido
  col=col*col*(3.0-2.0*col)*0.35+col*0.65;
  float vg=smoothstep(0.85,0.18,sqrt(r2)*(1.0+uVign));
  col*=mix(0.35,1.0,vg);
  float g=hash(vUV*vec2(1920.0,1080.0)+fract(uTime)*91.7)-0.5; col+=g*uGrain;
  col=mix(col,vec3(0.75,0.02,0.02)*dot(col,vec3(0.33))+vec3(0.35,0.0,0.0),uHurt*0.5*smoothstep(0.1,0.9,sqrt(r2)*1.8+uHurt*0.3));
  col+=vec3(0.9,0.05,0.03)*uAlarm*0.06;
  col+=uFlashW;
  o=vec4(col,1.0);
}`;

  /* ---------------- inizializzazione ---------------- */
  function init(c) {
    canvas = c;
    gl = GLX.init(c);
    if (!gl) return false;
    P.uber = GLX.program(VS_UBER, FS_UBER);
    P.shadow = GLX.program(VS_SHADOW, FS_SHADOW);
    P.part = GLX.program(VS_PART, FS_PART);
    P.bright = GLX.program(VS_FULL, FS_BRIGHT);
    P.down = GLX.program(VS_FULL, FS_DOWN);
    P.up = GLX.program(VS_FULL, FS_UP);
    P.comp = GLX.program(VS_FULL, FS_COMP);
    emptyVAO = gl.createVertexArray();
    // particelle
    partVAO = gl.createVertexArray(); gl.bindVertexArray(partVAO);
    partVBO = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, partVBO);
    gl.bufferData(gl.ARRAY_BUFFER, 4400 * 4 * 9 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
    partIBO = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, partIBO);
    const idx = new Uint16Array(4400 * 6);
    for (let i = 0; i < 4400; i++) { const b = i * 4; idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6); }
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    dummyShadow = GLX.depthTarget(4);
    return true;
  }

  const opt = { scale: 1, bloom: true, grain: 0.035 };
  function setOpts(o) { const rs = o.scale !== undefined && o.scale !== opt.scale; Object.assign(opt, o); if (rs && gl) resize(); }
  function setQuality(q) { quality = Q[q] ? q : 'high'; resize(); }

  function resize() {
    const qq = Q[quality];
    const dpr = Math.min(window.devicePixelRatio || 1, qq.dpr);
    W = Math.max(320, Math.floor(window.innerWidth * dpr * qq.scale * opt.scale));
    H = Math.max(180, Math.floor(window.innerHeight * dpr * qq.scale * opt.scale));
    if (W > 2400) { H = Math.floor(H * 2400 / W); W = 2400; }
    canvas.width = W; canvas.height = H;
    // target
    if (T.res) { gl.deleteFramebuffer(T.res.fb); gl.deleteTexture(T.res.tex); }
    if (T.msFB) { gl.deleteFramebuffer(T.msFB); gl.deleteRenderbuffer(T.msC); gl.deleteRenderbuffer(T.msD); }
    if (T.depth) gl.deleteRenderbuffer(T.depth);
    if (T.bloom) T.bloom.forEach(function (b) { gl.deleteFramebuffer(b.fb); gl.deleteTexture(b.tex); });
    T = {};
    T.res = GLX.colorTarget(W, H, 'hdr');
    T.depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, T.depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, T.depth);
    T.ms = 0;
    if (qq.msaa) {
      const samples = Math.min(qq.msaa, gl.getParameter(gl.MAX_SAMPLES));
      if (samples > 1) {
        T.msFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, T.msFB);
        T.msC = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, T.msC);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA16F, W, H);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, T.msC);
        T.msD = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, T.msD);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, W, H);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, T.msD);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) T.ms = samples;
      }
    }
    T.bloom = [];
    let bw = W >> 1, bh = H >> 1;
    for (let i = 0; i < 5; i++) { T.bloom.push(GLX.colorTarget(Math.max(2, bw), Math.max(2, bh), 'hdr')); bw >>= 1; bh >>= 1; }
    // ombra
    if (qq.shadow && (!shadowRT || shadowRT.size !== qq.shadow)) {
      if (shadowRT) { gl.deleteFramebuffer(shadowRT.fb); gl.deleteTexture(shadowRT.tex); }
      shadowRT = GLX.depthTarget(qq.shadow);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* ---------------- frustum ---------------- */
  function extractPlanes(m) {
    const r = [[m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]], [m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]],
      [m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]], [m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]],
      [m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]], [m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]]];
    for (let i = 0; i < 6; i++) {
      const l = Math.hypot(r[i][0], r[i][1], r[i][2]) || 1;
      planes[i * 4] = r[i][0] / l; planes[i * 4 + 1] = r[i][1] / l; planes[i * 4 + 2] = r[i][2] / l; planes[i * 4 + 3] = r[i][3] / l;
    }
  }
  function aabbVisible(mn, mx) {
    for (let i = 0; i < 6; i++) {
      const a = planes[i * 4], b = planes[i * 4 + 1], c = planes[i * 4 + 2], d = planes[i * 4 + 3];
      const px = a > 0 ? mx[0] : mn[0], py = b > 0 ? mx[1] : mn[1], pz = c > 0 ? mx[2] : mn[2];
      if (a * px + b * py + c * pz + d < 0) return false;
    }
    return true;
  }
  function sphereVisible(x, y, z, r) {
    for (let i = 0; i < 6; i++) {
      if (planes[i * 4] * x + planes[i * 4 + 1] * y + planes[i * 4 + 2] * z + planes[i * 4 + 3] < -r) return false;
    }
    return true;
  }

  /* ---------------- disegno ---------------- */
  function bindTex(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }

  function applyMat(u, m) {
    if (m === lastMat) return;
    lastMat = m;
    gl.uniform3fv(u.uAlbedo, m.albedo);
    gl.uniform1f(u.uBump, m.bump); gl.uniform1f(u.uRough, m.rough); gl.uniform1f(u.uMetal, m.metal); gl.uniform1f(u.uRVar, m.rvar);
    gl.uniform3fv(u.uEmissive, m.emissive); gl.uniform1f(u.uEmMode, m.emMode); gl.uniform1f(u.uUnlit, m.unlit); gl.uniform1f(u.uTrim, m.trim);
    gl.uniform2fv(u.uUV, m.uv);
    gl.uniform1f(u.uUseTex, m.tex ? 1 : 0); gl.uniform1f(u.uRoomLit, m.roomLit || 0);
    bindTex(0, (m.tex || Tex.get('white')).tex);
  }
  const ONES = new Float32Array(64).fill(1);
  const ID = M4.create(), NID = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const zero3 = new Float32Array(3);

  function drawNode(u, n, maxd) {
    if (!n.visible) return;
    if (n.mesh) {
      if (n.noPick) { /* nulla */ }
      applyMat(u, n.mat);
      gl.uniformMatrix4fv(u.uModel, false, n.world);
      M4.normal3(n.normalM, n.world);
      gl.uniformMatrix3fv(u.uNM, false, n.normalM);
      gl.uniform3fv(u.uTint, n.tint || zero3);
      gl.bindVertexArray(n.mesh.vao);
      gl.drawElements(gl.TRIANGLES, n.mesh.count, n.mesh.type, 0);
    }
    for (let i = 0; i < n.children.length; i++) drawNode(u, n.children[i]);
  }
  function drawShadowNode(u, n) {
    if (!n.visible || n.cast === false) return;
    if (n.mesh) {
      gl.uniformMatrix4fv(u.uModel, false, n.world);
      gl.bindVertexArray(n.mesh.vao);
      gl.drawElements(gl.TRIANGLES, n.mesh.count, n.mesh.type, 0);
    }
    for (let i = 0; i < n.children.length; i++) drawShadowNode(u, n.children[i]);
  }

  function drawBatch(b, additive) {
    if (!b.n) return;
    gl.bindVertexArray(partVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, partVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, b.data, 0, b.n * 9);
    gl.blendFunc(gl.ONE, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.drawElements(gl.TRIANGLES, (b.n / 4) * 6, gl.UNSIGNED_SHORT, 0);
  }

  function setupFrameUniforms(u, f, vpm) {
    gl.uniformMatrix4fv(u.uVP, false, vpm);
    gl.uniform3f(u.uCam, cam.x, cam.y, cam.z);
    gl.uniform3fv(u.uAmbient, f.amb);
    gl.uniform3f(u.uFogCol, 0.004, 0.005, 0.008);
    gl.uniform1f(u.uFogDens, f.fog === undefined ? 0.04 : f.fog);
    gl.uniform1f(u.uWallH, World.WALLH);
    gl.uniform1f(u.uAlarm, f.alarm || 0);
    gl.uniform2f(u.uLMInv, 1 / World.W, 1 / World.H);
    const n = Math.min(8, f.lights.length);
    for (let i = 0; i < n; i++) {
      const l = f.lights[i];
      dlPos[i * 4] = l.x; dlPos[i * 4 + 1] = l.y; dlPos[i * 4 + 2] = l.z; dlPos[i * 4 + 3] = l.r;
      dlCol[i * 4] = l.cr; dlCol[i * 4 + 1] = l.cg; dlCol[i * 4 + 2] = l.cb; dlCol[i * 4 + 3] = l.spec ? 1 : 0;
    }
    gl.uniform1i(u.uNDL, n);
    gl.uniform4fv(u.uDLPos, dlPos); gl.uniform4fv(u.uDLCol, dlCol);
    const tor = f.torch;
    gl.uniform1f(u.uFlOn, tor && tor.on ? 1 : 0);
    if (tor && tor.on) {
      gl.uniform4f(u.uFLPos, cam.x + cam.rx * 0.18 - cam.ux * 0.12, cam.y + cam.ry * 0.18 - cam.uy * 0.12, cam.z + cam.rz * 0.18 - cam.uz * 0.12, 1);
      gl.uniform4f(u.uFLDir, cam.fx, cam.fy, cam.fz, Math.cos(0.5));
      const k = tor.k === undefined ? 1 : tor.k;
      gl.uniform4f(u.uFLCol, 1.0 * k, 0.95 * k, 0.85 * k, Math.cos(0.18));
    }
    const useSh = tor && tor.on && Q[quality].shadow > 0 ? 1 : 0;
    gl.uniform1f(u.uShadowOn, useSh);
    gl.uniform1f(u.uShTexel, 1 / (Q[quality].shadow || 4));
    gl.uniformMatrix4fv(u.uFLVP, false, lvp);
    gl.uniform1i(u.uTex, 0); gl.uniform1i(u.uLM, 1); gl.uniform1i(u.uShadow, 2); gl.uniform1i(u.uRM, 3);
    gl.uniform1fv(u.uRoomK, f.roomK || ONES);
  }

  function render(f) {
    const qq = Q[quality];
    const aspect = W / H;
    // matrici camera
    cam.x = f.cam.x; cam.y = f.cam.y; cam.z = f.cam.z; cam.yaw = f.cam.yaw; cam.pitch = f.cam.pitch;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    cam.fx = cp * cy; cam.fy = sp; cam.fz = cp * sy;
    const rl = Math.hypot(cam.fz, cam.fx) || 1; cam.rx = -cam.fz / rl; cam.ry = 0; cam.rz = cam.fx / rl;
    cam.ux = cam.ry * cam.fz - cam.rz * cam.fy; cam.uy = cam.rz * cam.fx - cam.rx * cam.fz; cam.uz = cam.rx * cam.fy - cam.ry * cam.fx;
    M4.view(view, cam.x, cam.y, cam.z, cam.yaw, cam.pitch);
    M4.perspective(proj, (f.cam.fov || 72) * Math.PI / 180, aspect, 0.05, 60);
    M4.mul(vp, proj, view);
    M4.perspective(projVM, 58 * Math.PI / 180, aspect, 0.012, 6);
    M4.mul(vpVM, projVM, view);
    extractPlanes(vp);
    lastMat = null;

    // elenco visibile
    const maxD = 28;
    const vis = [];
    World.chunks.forEach(function (c) {
      if (Math.hypot(c.cx - cam.x, c.cz - cam.z) > maxD + 6) return;
      if (!aabbVisible(c.min, c.max)) return;
      vis.push(c);
    });
    const dyn = f.dyn.filter(function (n) {
      if (!n.visible) return false;
      const dx = n.world[12] - cam.x, dz = n.world[14] - cam.z;
      if (dx * dx + dz * dz > maxD * maxD) return false;
      return sphereVisible(n.world[12], n.world[13] + (n.cy || 0.5), n.world[14], n.radius || 1.2);
    });

    // ---- pass ombra della torcia ----
    const tor = f.torch;
    if (tor && tor.on && qq.shadow > 0 && shadowRT) {
      M4.perspective(lproj, 66 * Math.PI / 180, 1, 0.1, 24);
      const px = cam.x + cam.rx * 0.18 - cam.ux * 0.12, py = cam.y + cam.ry * 0.18 - cam.uy * 0.12, pz = cam.z + cam.rz * 0.18 - cam.uz * 0.12;
      M4.lookAt(lview, px, py, pz, px + cam.fx, py + cam.fy, pz + cam.fz, 0, 1, 0);
      M4.mul(lvp, lproj, lview);
      const lvpRaw = lvp;
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowRT.fb);
      gl.viewport(0, 0, shadowRT.size, shadowRT.size);
      gl.colorMask(false, false, false, false);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2.5, 5);
      gl.useProgram(P.shadow.p);
      gl.uniformMatrix4fv(P.shadow.u.uLVP, false, lvpRaw);
      const lp = [lvpRaw];
      extractPlanes(lvpRaw);
      World.chunks.forEach(function (c) {
        if (Math.hypot(c.cx - cam.x, c.cz - cam.z) > 24) return;
        if (!aabbVisible(c.min, c.max)) return;
        c.parts.forEach(function (p) {
          if (!p.cast) return;
          gl.uniformMatrix4fv(P.shadow.u.uModel, false, ID);
          gl.bindVertexArray(p.mesh.vao); gl.drawElements(gl.TRIANGLES, p.mesh.count, p.mesh.type, 0);
        });
      });
      World.doorNodes.forEach(function (n) { drawShadowNode(P.shadow.u, n); });
      f.dyn.forEach(function (n) {
        const dx = n.world[12] - cam.x, dz = n.world[14] - cam.z;
        if (dx * dx + dz * dz > 22 * 22) return;
        if (!sphereVisible(n.world[12], n.world[13] + 0.5, n.world[14], n.radius || 1.2)) return;
        drawShadowNode(P.shadow.u, n);
      });
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.colorMask(true, true, true, true);
      void lp;
      extractPlanes(vp);
    }

    // ---- pass principale ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.ms ? T.msFB : T.res.fb);
    gl.viewport(0, 0, W, H);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
    gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.clearColor(0.004, 0.005, 0.007, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(P.uber.p);
    const u = P.uber.u;
    setupFrameUniforms(u, f, vp);
    bindTex(1, World.lightmap.tex);
    bindTex(3, World.roomMap.tex);
    bindTex(2, (tor && tor.on && shadowRT && qq.shadow) ? shadowRT.tex : dummyShadow.tex);
    gl.uniform1f(u.uTrim, 0);
    // il contesto di default per le meshes statiche
    gl.uniformMatrix4fv(u.uModel, false, ID);
    gl.uniformMatrix3fv(u.uNM, false, NID);
    gl.uniform3fv(u.uTint, zero3);
    vis.forEach(function (c) {
      c.parts.forEach(function (p) {
        applyMat(u, p.mat);
        gl.bindVertexArray(p.mesh.vao);
        gl.drawElements(gl.TRIANGLES, p.mesh.count, p.mesh.type, 0);
      });
    });
    World.doorNodes.forEach(function (n) {
      const dx = n.world[12] - cam.x, dz = n.world[14] - cam.z;
      if (dx * dx + dz * dz < 26 * 26) drawNode(u, n);
    });
    gl.uniform1f(u.uTrim, 0);
    dyn.forEach(function (n) { drawNode(u, n); });

    // ---- trasparenze: decalcomanie e particelle ----
    gl.useProgram(P.part.p);
    gl.uniformMatrix4fv(P.part.u.uVP, false, vp);
    gl.uniform1i(P.part.u.uAtlas, 0);
    bindTex(0, Tex.get('atlas').tex);
    gl.enable(gl.BLEND); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
    drawBatch(Batches.alpha, false);
    drawBatch(Batches.add, true);
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // ---- viewmodel (arma in prima persona) ----
    if (f.vm) {
      gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      M4.invert(camWorld, view);
      f.vm.update(camWorld);
      gl.useProgram(P.uber.p);
      lastMat = null;
      setupFrameUniforms(u, f, vpVM);
      bindTex(1, World.lightmap.tex);
      bindTex(3, World.roomMap.tex);
      bindTex(2, (tor && tor.on && shadowRT && qq.shadow) ? shadowRT.tex : dummyShadow.tex);
      gl.uniform1f(u.uFogDens, 0.0);
      gl.uniform3fv(u.uTint, zero3);
      drawNode(u, f.vm);
      gl.useProgram(P.part.p);
      gl.uniformMatrix4fv(P.part.u.uVP, false, vpVM);
      bindTex(0, Tex.get('atlas').tex);
      gl.enable(gl.BLEND); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      drawBatch(Batches.vmAdd, true);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);

    // risolvi MSAA
    if (T.ms) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.msFB);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.res.fb);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }

    // ---- bloom ----
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(emptyVAO);
    const post = f.post || {};
    if (qq.bloom && opt.bloom) {
      let src = T.res, prog = P.bright;
      for (let i = 0; i < T.bloom.length; i++) {
        const dst = T.bloom[i];
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h);
        gl.useProgram(prog.p);
        bindTex(0, src.tex); gl.uniform1i(prog.u.uSrc, 0); gl.uniform2f(prog.u.uTexel, 1 / src.w, 1 / src.h);
        if (i === 0) gl.uniform1f(prog.u.uThr, 1.0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        src = dst; prog = P.down;
      }
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(P.up.p);
      for (let i = T.bloom.length - 1; i > 0; i--) {
        const s = T.bloom[i], d = T.bloom[i - 1];
        gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb); gl.viewport(0, 0, d.w, d.h);
        bindTex(0, s.tex); gl.uniform1i(P.up.u.uSrc, 0); gl.uniform2f(P.up.u.uTexel, 1 / s.w, 1 / s.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.disable(gl.BLEND);
    }

    // ---- composizione finale ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(P.comp.p);
    const cu = P.comp.u;
    bindTex(0, T.res.tex); gl.uniform1i(cu.uScene, 0);
    bindTex(1, T.bloom[0].tex); gl.uniform1i(cu.uBloom, 1);
    gl.uniform1f(cu.uBloomStr, qq.bloom && opt.bloom ? 0.55 : 0);
    gl.uniform1f(cu.uGrain, opt.grain);
    gl.uniform1f(cu.uExposure, f.exposure || 1.15);
    gl.uniform1f(cu.uTime, f.time || 0);
    gl.uniform1f(cu.uVign, post.vign || 0);
    gl.uniform1f(cu.uHurt, post.hurt || 0);
    gl.uniform1f(cu.uLow, post.low || 0);
    gl.uniform1f(cu.uFlashW, post.flashW || 0);
    gl.uniform1f(cu.uAlarm, f.alarm || 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  function clearBatches() { Batches.alpha.n = 0; Batches.add.n = 0; Batches.vmAdd.n = 0; }

  return {
    init: init, resize: resize, setQuality: setQuality, setOpts: setOpts, render: render, clearBatches: clearBatches, Batches: Batches, cam: cam,
    get W() { return W; }, get H() { return H; }, get quality() { return quality; }
  };
})();
