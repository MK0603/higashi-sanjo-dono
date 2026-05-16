import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GridBuilder } from './GridBuilder';

const scale = 2;
// 幅を2倍（80->160）に拡張してシネマティックなパノラマビューへ
const width = 80 * scale;   // 160
const height = 24 * scale;  // 48
const depth = 50 * scale;   // 100

const volume = Array.from({ length: depth }, () => 
  Array.from({ length: height }, () => Array(width).fill(null))
);

function fillBox(x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
  for (let dz = 0; dz < d; dz++) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (x+dx>=0 && x+dx<width && y+dy>=0 && y+dy<height && z+dz>=0 && z+dz<depth) {
          volume[z+dz][y+dy][x+dx] = color;
        }
      }
    }
  }
}

function fillSphere(cx: number, cy: number, cz: number, r: number, color: string) {
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dz = (z - cz) * 1.2;
        if (dx*dx + dy*dy + dz*dz <= r*r) {
          volume[z][y][x] = color;
        }
      }
    }
  }
}

// 1. 最奥の空と月 (z = 0〜5)
fillBox(0, 0, 0, width, height, 1, '#051024');
for (let y=0; y<height; y++) {
  for(let x=0; x<width; x++) {
    // 朧月夜（おぼろづきよ）
    const dx = x - 130; const dy = y - 12;
    const r2 = dx*dx + dy*dy;
    if (r2 < 4*4) volume[1][y][x] = '#M_ffeedd'; // 月の芯
    else if (r2 < 10*10) volume[1][y][x] = '#M_aabbcc'; // 内側のハロー
    else if (r2 < 18*18) volume[1][y][x] = '#4b7596'; // 外側のぼんやりしたにじみ
  }
}
// 遠山 (z=2〜20)
for (let z=2; z<=20; z++) {
  for (let x=0; x<width; x++) {
    // 遠くほど高く、手前ほど低くなるようになだらかな山を作成
    const mShape = Math.sin(x * 0.04) * 6 + Math.cos(x * 0.08) * 4 + 20 + (z-2)*1.2;
    for (let y=Math.floor(height - mShape); y<height; y++) {
      volume[z][y][x] = '#030814';
    }
  }
}

// 2. 地面と前庭、うねる池 (z = 20〜95)
for (let z=20; z<=95; z++) {
  for (let x=0; x<width; x++) {
    for (let y=43; y<height; y++) {
      let color = '#050a0a'; // 庭の土、苔
      // 蛇行する池の生成
      const pondCenterX = 80 + Math.sin(z * 0.1) * 20;
      const dx = x - pondCenterX;
      // z=30〜70あたりを池の中心とする
      const pondZWeight = (z >= 40 && z <= 65) ? 1.0 : (z >= 25 && z < 40) ? (z-25)/15 : (z > 65 && z <= 80) ? (80-z)/15 : 0;
      
      // 幅30〜40くらいの池
      if (pondZWeight > 0 && Math.abs(dx) < 25 * pondZWeight) {
        // 少しノイズを加えて自然な岸辺に
        if (Math.abs(dx) + (Math.sin(x*0.5)*2) < 22 * pondZWeight) {
            // 深さ2-3ボクセル分の池
            if (y >= 43 && y <= 45) {
                color = '#W_081820';
            }
        }
      }
      volume[z][y][x] = color;
    }
  }
}

// 白砂の庭（寝殿の手前 z=75〜95、広大な前庭）
for (let z=75; z<=95; z++) {
    for (let x=45; x<=115; x++) {
        // 水でない場所でy=43の表面を白砂の色に
        if (volume[z][43][x] === '#050a0a') {
            volume[z][43][x] = '#0d1317'; // ほのかに明るい砂
        }
    }
}

// 3. 赤い橋 (池をまたぐように z=55〜58, x=65〜95)
for (let z=55; z<=58; z++) {
  for (let x=65; x<=95; x++) {
    const arch = Math.pow((x - 80) / 15, 2) * 3 + 37; 
    const yBase = Math.floor(arch);
    volume[z][yBase][x] = '#ff3c00';   // より鮮やかな朱色（赤）に変更
    volume[z][yBase+1][x] = '#ff3c00'; 
    if (z===55 || z===58) {
      volume[z][yBase-2][x] = '#d31b0a'; // 暗い部分も鮮やかに
      volume[z][yBase-1][x] = '#d31b0a';
    }
  }
}

// 4. 小島と立体的な松の木 (中央右寄り x=95〜115, z=40〜50)
fillSphere(105, 43, 45, 9, '#050a0a'); // 小島
fillSphere(105, 31, 45, 8, '#123627'); // 松の葉
fillBox(104, 35, 44, 2, 8, 2, '#1c130d'); // 松の幹

// 左奥の森 (x=10〜40, z=20〜40)
fillSphere(20, 26, 30, 15, '#061c14');
fillSphere(35, 30, 35, 12, '#061c14');
fillBox(18, 36, 29, 3, 8, 3, '#120d09');
fillBox(34, 38, 34, 3, 6, 3, '#120d09');

// 5. 左側の渡殿と釣殿 (x=15〜40, z=50〜95)
fillBox(15, 20, 50, 25, 6, 45, '#161311'); // 屋根 (檜皮葺のような暗灰茶色)
// 柱を等間隔で立てる
for (let pz=54; pz<=92; pz+=8) {
    fillBox(18, 24, pz, 2, 20, 2, '#26180e'); // 柱 (わずかに木目を感じる色)
    fillBox(36, 24, pz, 2, 20, 2, '#26180e');
}
fillBox(15, 38, 50, 25, 2, 45, '#2e1e12'); // 床 (縁側のような木の温かみ)

// 左の釣殿（池にせり出す部分 z=40〜50）
fillBox(10, 18, 40, 35, 8, 12, '#161311'); 
fillBox(14, 24, 42, 2, 20, 2, '#26180e');
fillBox(38, 24, 42, 2, 20, 2, '#26180e');
fillBox(14, 24, 48, 2, 20, 2, '#26180e');
fillBox(38, 24, 48, 2, 20, 2, '#26180e');
fillBox(10, 38, 40, 35, 2, 12, '#2e1e12'); 
fillBox(24, 34, 41, 3, 4, 3, '#fc8a18ff'); // 灯籠


// 6. 右側の渡殿と釣殿 (x=120〜145, z=50〜95)
fillBox(120, 20, 50, 25, 6, 45, '#161311'); // 屋根
for (let pz=54; pz<=92; pz+=8) {
    fillBox(122, 24, pz, 2, 20, 2, '#26180e');
    fillBox(140, 24, pz, 2, 20, 2, '#26180e');
}
fillBox(120, 38, 50, 25, 2, 45, '#2e1e12'); // 床

// 右の釣殿 (z=40〜50)
fillBox(115, 18, 40, 35, 8, 12, '#161311');
fillBox(118, 24, 42, 2, 20, 2, '#26180e');
fillBox(142, 24, 42, 2, 20, 2, '#26180e');
fillBox(118, 24, 48, 2, 20, 2, '#26180e');
fillBox(142, 24, 48, 2, 20, 2, '#26180e');
fillBox(115, 38, 40, 35, 2, 12, '#2e1e12'); 
fillBox(130, 34, 41, 3, 4, 3, '#f07f00'); 


// 7. 寝殿（一番手前 z=95〜99、ここから庭を見下ろす）
fillBox(4, 4, 96, 6, 44, 4, '#26180e');   // 左の柱
fillBox(150, 4, 96, 6, 44, 4, '#26180e'); // 右の柱
fillBox(0, 0, 96, width, 4, 4, '#26180e'); // 上部の梁
fillBox(0, 38, 96, width, 4, 4, '#2e1e12'); // 床
fillBox(10, 35, 96, 140, 2, 2, '#26180e');  // 高欄
// 御簾
for(let z=96; z<=97; z++){
  for(let y=4; y<=16; y+=2){
    for(let x=10; x<150; x++){
      volume[z][y][x] = '#2e251a';
    }
  }
}

const layersData = [];
for (let z = 0; z < depth; z++) {
  layersData.push({ z, data: volume[z] });
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#010408');
// フォグを少し薄くして月を見えやすくする (0.015 -> 0.01)
scene.fog = new THREE.FogExp2('#010408', 0.01);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

// 画面の横幅にジオラマがぴったり収まるようにカメラのZ位置を自動計算する関数
function fitCameraToGrid() {
  const fovInRadians = (camera.fov * Math.PI) / 180;
  // アスペクト比から水平方向の視野角（ラジアン）を計算
  const hFovInRadians = 2 * Math.atan(Math.tan(fovInRadians / 2) * camera.aspect);
  
  // ワールド座標系でのグリッドの実際の横幅と奥行き
  const worldWidth = width / scale;
  const worldDepth = depth / scale;
  
  // 横幅が画面に収まるための、被写体（前面）からの距離
  // 少しだけ余白を持たせるために 1.05 を掛ける
  const distance = ((worldWidth / 2) / Math.tan(hFovInRadians / 2)) * 1.05;
  
  // グリッドの前面（Z軸の手前側）からの距離なので、depthの半分を足す
  camera.position.set(0, 0, distance + (worldDepth / 2));
}

// 初期化時にフィットさせる
fitCameraToGrid();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const appDiv = document.getElementById('app');
if (appDiv) {
  appDiv.innerHTML = '';
  appDiv.appendChild(renderer.domElement);
} else {
  document.body.appendChild(renderer.domElement);
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = false; // 自動回転を無効化
controls.autoRotateSpeed = 0.15; // 景色が広いので回転はゆっくりに
controls.maxAzimuthAngle = Math.PI / 4;
controls.minAzimuthAngle = -Math.PI / 4;

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.15;
bloomPass.strength = 1.2;
bloomPass.radius = 0.8;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
const outputPass = new OutputPass();
composer.addPass(outputPass);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

// 月からの光源（ホタルの光0.8の半分 = 0.4に設定）
// 光源の位置は月ボクセルの中心付近 (x=130, y=12, z=1のワールド座標)
const moonPointLight = new THREE.PointLight(0xffeedd, 0.4, 150);
moonPointLight.position.set(50, 12, -13);
scene.add(moonPointLight);

// 灯籠の光 (左と右の釣殿に合わせて2つ追加)
const lanternLightL = new THREE.PointLight(0xff952b, 2.0, 40);
lanternLightL.position.set(-50, -5, 30); // 左の灯籠
scene.add(lanternLightL);

const lanternLightR = new THREE.PointLight(0xff952b, 2.0, 40);
lanternLightR.position.set(50, -5, 30); // 右の灯籠
scene.add(lanternLightR);



const builder = new GridBuilder();
const gridModel = builder.build(width, height, depth, layersData);
gridModel.scale.set(1 / scale, 1 / scale, 1 / scale);
gridModel.position.set(0, 0, 0);
scene.add(gridModel);

// ホタルのパーティクル（横幅の拡大に合わせて広範囲に）
const fireflyCount = 12; // 領域が広がったので数も少し増やす
const fireflyGeo = new THREE.SphereGeometry(0.15, 4, 4);
const fireflyMat = new THREE.MeshBasicMaterial({ color: 0xccffaa });
const fireflies = new THREE.InstancedMesh(fireflyGeo, fireflyMat, fireflyCount);
const fireflyData: { x: number, y: number, z: number, speed: number, offset: number, light: THREE.PointLight }[] = [];

const dummy = new THREE.Object3D();
for (let i = 0; i < fireflyCount; i++) {
  // 各ホタルに本物の点光源（PointLight）を持たせる
  const pl = new THREE.PointLight(0xccffaa, 1.0, 15);
  scene.add(pl);

  fireflyData.push({
    x: (Math.random() - 0.5) * 60, // -30 to 30 へ拡大
    y: -8 + Math.random() * 8,     
    z: -5 + Math.random() * 15,    
    speed: 0.1 + Math.random() * 0.15, 
    offset: Math.random() * 100,
    light: pl
  });
}
scene.add(fireflies);

const startTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const time = (performance.now() - startTime) * 0.001;
  
  gridModel.position.y = Math.sin(time * 0.8) * 0.3;
  
  // 水面のきらめきは削除しました

  for (let i = 0; i < fireflyCount; i++) {
    const data = fireflyData[i];
    const posX = data.x + Math.sin(time * data.speed + data.offset) * 1.5;
    const posY = data.y + Math.cos(time * data.speed * 0.8 + data.offset) * 0.8;
    const posZ = data.z + Math.sin(time * data.speed * 0.5 + data.offset) * 1.5;
    
    dummy.position.set(posX, posY, posZ);
    const scale = (Math.sin(time * 1.5 + data.offset) + 1.0) * 0.5 + 0.5;
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    fireflies.setMatrixAt(i, dummy.matrix);

    // 光源の位置と強さもホタルに同期させる（水面に反射するようになる）
    data.light.position.set(posX, posY, posZ);
    data.light.intensity = scale * 0.8;
  }
  fireflies.instanceMatrix.needsUpdate = true;

  controls.update();
  composer.render();
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  fitCameraToGrid(); // ウィンドウサイズ変更時も横幅にフィットさせる
});
