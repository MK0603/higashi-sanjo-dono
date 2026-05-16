import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export class GridBuilder {
  private geometry: THREE.BufferGeometry;
  private emptyMaterial: THREE.MeshPhysicalMaterial;
  private colorMaterial: THREE.MeshPhysicalMaterial;
  private waterMaterial: THREE.MeshPhysicalMaterial;
  private moonMaterial: THREE.MeshBasicMaterial;

  constructor() {
    this.geometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.3);
    
    this.emptyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff,
      emissive: 0x88ccff, // 少しだけ青白く光らせる
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.005,         // 透過度をさらに上げる（99%透過）
      roughness: 0.15,
      metalness: 0.1,
      depthWrite: false, 
    });

    // 「後ろが30%くらい見えている」透過度に変更
    this.colorMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,          // 80%の透過度（非常に高い透明感）
      roughness: 0.1,
      metalness: 0.1,
      depthWrite: false,     // 深度ソート問題を避けるためfalse
    });

    // 鏡面反射を持つ水面マテリアル
    this.waterMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,          // 水の質量を感じさせるためにやや不透明
      roughness: 0.0,        // ツルツル（鏡面）
      metalness: 0.9,        // 金属のように強く反射する
      depthWrite: true,
    });

    // ホタルと同じ形式の「自ら発光する」マテリアル
    this.moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      // MeshBasicMaterial はライトの影響を受けず、指定した色そのままに光る
    });
  }

  public build(
    width: number,
    height: number,
    depth: number,
    layersData: { z: number; data: (string | null)[][] }[]
  ): THREE.Group {
    const group = new THREE.Group();

    const startX = -width / 2;
    const startY = -height / 2;
    const startZ = -depth / 2;

    const colorMap = new Map<string, string>();
    layersData.forEach((layer) => {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const hex = layer.data[y][x];
          if (hex !== null) {
            colorMap.set(`${x},${y},${layer.z}`, hex);
          }
        }
      }
    });

    // 「裏側から見えない問題」を解決するため、Z深度ごとに別々のInstancedMeshを作成する。
    // これによりThree.jsのカメラベースの自動Zソート（奥のものから描画）が正しく機能する。
    for (let z = 0; z < depth; z++) {
      let colorCount = 0;
      let emptyCount = 0;
      let waterCount = 0;
      let moonCount = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const key = `${x},${y},${z}`;
          if (colorMap.has(key)) {
            const hexStr = colorMap.get(key)!;
            if (hexStr.startsWith('#W_')) waterCount++;
            else if (hexStr.startsWith('#M_')) moonCount++;
            else colorCount++;
          } else {
            emptyCount++;
          }
        }
      }

      const emptyMesh = new THREE.InstancedMesh(this.geometry, this.emptyMaterial, emptyCount);
      const colorMesh = new THREE.InstancedMesh(this.geometry, this.colorMaterial, colorCount);
      const waterMesh = new THREE.InstancedMesh(this.geometry, this.waterMaterial, waterCount);
      const moonMesh = new THREE.InstancedMesh(this.geometry, this.moonMaterial, moonCount);

      const zPos = startZ + z + 0.5;
      emptyMesh.position.z = zPos;
      colorMesh.position.z = zPos;
      waterMesh.position.z = zPos;
      moonMesh.position.z = zPos;

      const dummy = new THREE.Object3D();
      const colorObj = new THREE.Color();

      let emptyIndex = 0;
      let colorIndex = 0;
      let waterIndex = 0;
      let moonIndex = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          dummy.position.set(startX + x + 0.5, startY + (height - y) - 0.5, 0);
          dummy.scale.set(0.92, 0.92, 0.92);
          dummy.updateMatrix();

          const key = `${x},${y},${z}`;
          if (colorMap.has(key)) {
            const rawHex = colorMap.get(key)!;
            const isWater = rawHex.startsWith('#W_');
            const isMoon = rawHex.startsWith('#M_');
            // #W_ や #M_ を除去した後に '#' を付け直して正しいカラーコードにする
            const hex = isWater || isMoon ? '#' + rawHex.substring(3) : rawHex;

            if (isWater) {
              waterMesh.setMatrixAt(waterIndex, dummy.matrix);
              colorObj.set(hex).multiplyScalar(1.0); // 水は元色に近く
              waterMesh.setColorAt(waterIndex, colorObj);
              waterIndex++;
            } else if (isMoon) {
              moonMesh.setMatrixAt(moonIndex, dummy.matrix);
              // MeshBasicMaterial に元の色をそのままセット
              colorObj.set(hex);
              moonMesh.setColorAt(moonIndex, colorObj);
              moonIndex++;
            } else {
              colorMesh.setMatrixAt(colorIndex, dummy.matrix);
              colorObj.set(hex).multiplyScalar(2.5);
              colorMesh.setColorAt(colorIndex, colorObj);
              colorIndex++;
            }
          } else {
            emptyMesh.setMatrixAt(emptyIndex, dummy.matrix);
            emptyIndex++;
          }
        }
      }

      if (emptyCount > 0) {
        emptyMesh.instanceMatrix.needsUpdate = true;
        group.add(emptyMesh);
      }
      if (colorCount > 0) {
        colorMesh.instanceMatrix.needsUpdate = true;
        if (colorMesh.instanceColor) colorMesh.instanceColor.needsUpdate = true;
        group.add(colorMesh);
      }
      if (waterCount > 0) {
        waterMesh.instanceMatrix.needsUpdate = true;
        if (waterMesh.instanceColor) waterMesh.instanceColor.needsUpdate = true;
        group.add(waterMesh);
      }
      if (moonCount > 0) {
        moonMesh.instanceMatrix.needsUpdate = true;
        if (moonMesh.instanceColor) moonMesh.instanceColor.needsUpdate = true;
        group.add(moonMesh);
      }
    }

    return group;
  }
}
