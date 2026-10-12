import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Original procedural geometry. Units describe a ~4-unit, eight-head-tall human.
// Each ring is [height, half-width, half-depth, center-x, center-z].
function loft(rings, sides = 20) {
  const positions = [],
    indices = [];
  rings.forEach(([y, rx, rz, cx = 0, cz = 0]) => {
    for (let i = 0; i <= sides; i++) {
      const theta = (i / sides) * Math.PI * 2;
      positions.push(cx + Math.cos(theta) * rx, y, cz + Math.sin(theta) * rz);
    }
  });
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < sides; i++) {
      const a = j * (sides + 1) + i,
        b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildHumanoid() {
  const parts = [];
  // Pelvis, abdomen, ribcage and clavicle taper into the neck.
  parts.push(
    loft(
      [
        [1.83, 0.2, 0.13],
        [1.91, 0.32, 0.18],
        [2.06, 0.36, 0.2, 0, -0.015],
        [2.21, 0.29, 0.17],
        [2.38, 0.28, 0.17],
        [2.53, 0.35, 0.21],
        [2.71, 0.44, 0.24, 0, 0.012],
        [2.86, 0.49, 0.22],
        [2.98, 0.49, 0.17],
        [3.06, 0.34, 0.13],
        [3.14, 0.14, 0.105],
      ],
      32,
    ),
  );
  parts.push(
    loft(
      [
        [3.08, 0.13, 0.11],
        [3.21, 0.105, 0.105],
        [3.32, 0.12, 0.12],
      ],
      20,
    ),
  );
  // Jaw, cheeks, temples and rounded skull; face looks toward +Z.
  parts.push(
    loft(
      [
        [3.27, 0.045, 0.055, 0, 0.07],
        [3.31, 0.115, 0.12, 0, 0.065],
        [3.41, 0.175, 0.16, 0, 0.035],
        [3.53, 0.21, 0.185, 0, 0.012],
        [3.67, 0.22, 0.19],
        [3.81, 0.2, 0.175, 0, -0.012],
        [3.9, 0.14, 0.12, 0, -0.015],
        [3.94, 0.002, 0.002],
      ],
      28,
    ),
  );
  parts.push(
    loft(
      [
        [3.45, 0.025, 0.024, 0, 0.18],
        [3.5, 0.042, 0.055, 0, 0.2],
        [3.6, 0.018, 0.014, 0, 0.19],
      ],
      12,
    ),
  );

  for (const s of [-1, 1]) {
    parts.push(
      loft([
        [1.03, 0.13, 0.14, s * 0.245, 0.025],
        [1.17, 0.145, 0.155, s * 0.25],
        [1.39, 0.175, 0.175, s * 0.24, -0.018],
        [1.64, 0.195, 0.19, s * 0.225, -0.015],
        [1.87, 0.2, 0.185, s * 0.2],
        [2.0, 0.17, 0.15, s * 0.185],
      ]),
    );
    parts.push(
      loft([
        [0.18, 0.075, 0.075, s * 0.275],
        [0.34, 0.085, 0.085, s * 0.27, -0.02],
        [0.58, 0.123, 0.133, s * 0.263, -0.045],
        [0.78, 0.14, 0.145, s * 0.256, -0.045],
        [0.96, 0.12, 0.125, s * 0.25, 0.008],
        [1.08, 0.13, 0.135, s * 0.245, 0.025],
      ]),
    );
    parts.push(
      loft(
        [
          [0.04, 0.092, 0.19, s * 0.28, 0.1],
          [0.07, 0.107, 0.235, s * 0.28, 0.13],
          [0.16, 0.096, 0.205, s * 0.28, 0.1],
          [0.26, 0.073, 0.09, s * 0.277],
        ],
        20,
      ),
    );
    parts.push(
      loft([
        [2.42, 0.1, 0.105, s * 0.72],
        [2.58, 0.135, 0.14, s * 0.675],
        [2.78, 0.156, 0.15, s * 0.625],
        [2.94, 0.16, 0.155, s * 0.56],
        [3.02, 0.105, 0.1, s * 0.52],
      ]),
    );
    parts.push(
      loft([
        [1.99, 0.063, 0.066, s * 0.84, 0.04],
        [2.11, 0.08, 0.085, s * 0.818, 0.024],
        [2.25, 0.105, 0.11, s * 0.78, 0.004],
        [2.42, 0.099, 0.105, s * 0.72],
      ]),
    );
    parts.push(
      loft(
        [
          [1.77, 0.065, 0.033, s * 0.884, 0.055],
          [1.85, 0.088, 0.043, s * 0.87, 0.05],
          [1.99, 0.065, 0.055, s * 0.84, 0.04],
        ],
        14,
      ),
    );
    for (let f = 0; f < 4; f++) {
      const cx = s * (0.822 + f * 0.04),
        length = [0.12, 0.17, 0.18, 0.145][f];
      parts.push(
        loft(
          [
            [1.78 - length, 0.008, 0.009, cx + s * 0.032, 0.064],
            [1.78 - length / 2, 0.018, 0.019, cx + s * 0.016, 0.06],
            [1.8, 0.021, 0.024, cx, 0.055],
          ],
          8,
        ),
      );
    }
    parts.push(
      loft(
        [
          [1.76, 0.01, 0.015, s * 0.744, 0.089],
          [1.83, 0.028, 0.025, s * 0.756, 0.07],
          [1.92, 0.033, 0.03, s * 0.803, 0.047],
        ],
        10,
      ),
    );
  }
  const body = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  const joints = [
    [0, 3.18, 0],
    [0, 2.7, 0.25],
    [0, 2.09, 0.2],
  ];
  for (const s of [-1, 1])
    joints.push(
      [s * 0.55, 2.94, 0.04],
      [s * 0.72, 2.42, 0.035],
      [s * 0.84, 2.0, 0.075],
      [s * 0.245, 1.05, 0.12],
      [s * 0.275, 0.24, 0.04],
    );
  const strands = [];
  const paths = [
    [
      [0, 3.15, 0.11],
      [0, 2.8, 0.25],
      [0, 2.45, 0.175],
      [0, 2.08, 0.205],
    ],
    ...[-1, 1].map((s) => [
      [s * 0.14, 3.05, 0.115],
      [s * 0.43, 2.87, 0.16],
      [s * 0.64, 2.65, 0.12],
      [s * 0.74, 2.36, 0.1],
      [s * 0.85, 1.95, 0.1],
    ]),
    ...[-1, 1].map((s) => [
      [s * 0.13, 2.08, 0.18],
      [s * 0.22, 1.7, 0.175],
      [s * 0.25, 1.05, 0.15],
      [s * 0.27, 0.58, 0.085],
      [s * 0.28, 0.18, 0.14],
    ]),
  ];
  paths.forEach((path) =>
    strands.push(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p))),
        48,
        0.008,
        5,
        false,
      ),
    ),
  );
  const energy = mergeGeometries(strands);
  strands.forEach((part) => part.dispose());
  return { body, energy, joints };
}

export const hologramVertex = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -view.xyz;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * view;
  }
`;

export const hologramFragment = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);
    float lines = pow(0.5 + 0.5 * sin(vWorld.y * 145.0 - uTime * 1.4), 5.0);
    float scanY = mod(uTime * 0.52, 4.8) - 0.4;
    float scan = exp(-pow((vWorld.y - scanY) * 13.0, 2.0));
    float chest = exp(-length(vWorld - vec3(0.0, 2.7, 0.18)) * 5.0);
    vec3 color = mix(vec3(0.018, 0.09, 0.23), uColor, rim * .72 + lines * .15 + scan * .85);
    color += uColor * chest * .18;
    gl_FragColor = vec4(color, .22 + rim * .47 + lines * .065 + scan * .35);
  }
`;
