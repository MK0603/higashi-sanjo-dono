import * as THREE from 'three';

export class LayerBuilder {
  private geometry: THREE.BoxGeometry;
  private material: THREE.MeshStandardMaterial;

  constructor() {
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.1,
    });
  }

  public createLayer(pixelData: (string | null)[][], zOffset: number): THREE.InstancedMesh {
    const height = pixelData.length;
    if (height === 0) throw new Error("Empty pixel data");
    const width = pixelData[0].length;
    
    let count = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixelData[y][x] !== null) count++;
      }
    }

    const mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
    mesh.position.z = zOffset;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let instanceId = 0;

    const startX = -width / 2;
    const startY = -height / 2;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const hexColor = pixelData[y][x];
        if (hexColor !== null) {
          dummy.position.set(startX + x + 0.5, startY + (height - y) - 0.5, 0);
          
          // イコライザーやブロックの隙間を表現するため少し縮小
          dummy.scale.set(0.85, 0.85, 0.85);
          
          dummy.updateMatrix();
          mesh.setMatrixAt(instanceId, dummy.matrix);
          
          color.set(hexColor);
          mesh.setColorAt(instanceId, color);
          
          instanceId++;
        }
      }
    }
    
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    return mesh;
  }
}
