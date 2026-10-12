import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { buildHumanoid, hologramFragment, hologramVertex } from "./humanoid";

function Human({ animate, color }) {
  const group = useRef(),
    core = useRef(),
    points = useRef();
  const geometry = useMemo(buildHumanoid, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: hologramVertex,
        fragmentShader: hologramFragment,
        uniforms: {
          uTime: { value: 5.9 },
          uColor: { value: new THREE.Color("#41deff") },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const particleGeometry = useMemo(() => {
    const vertices = geometry.body.attributes.position;
    const positions = [];
    for (let i = 0; i < vertices.count; i += 4)
      positions.push(
        vertices.getX(i) * 0.92,
        vertices.getY(i),
        vertices.getZ(i) * 0.92,
      );
    return new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
  }, [geometry]);
  useEffect(() => {
    material.uniforms.uColor.value.set(color);
  }, [color, material]);
  useEffect(() => {
    const object = new THREE.Object3D();
    geometry.joints.forEach((position, index) => {
      object.position.set(...position);
      object.updateMatrix();
      core.current.setMatrixAt(index, object.matrix);
    });
    core.current.instanceMatrix.needsUpdate = true;
    return () => {
      geometry.body.dispose();
      geometry.energy.dispose();
      particleGeometry.dispose();
      material.dispose();
    };
  }, [geometry, material, particleGeometry]);
  useFrame((_, delta) => {
    if (!animate) return;
    material.uniforms.uTime.value += Math.min(delta, 0.05);
    const t = material.uniforms.uTime.value;
    group.current.scale.y = 1 + Math.sin(t * 1.3) * 0.004;
    group.current.rotation.y = 0.13 + Math.sin(t * 0.32) * 0.045;
    points.current.material.opacity = 0.35 + Math.sin(t * 0.8) * 0.12;
  });
  return (
    <group ref={group} rotation={[0, 0.13, 0]}>
      <mesh geometry={geometry.body} material={material} />
      <mesh geometry={geometry.body}>
        <meshBasicMaterial
          color="#51c9ff"
          transparent
          opacity={0.085}
          wireframe
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh geometry={geometry.energy}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.54}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <points ref={points} geometry={particleGeometry}>
        <pointsMaterial
          color="#98f6ff"
          size={0.014}
          transparent
          opacity={0.45}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <instancedMesh ref={core} args={[null, null, geometry.joints.length]}>
        <sphereGeometry args={[0.027, 10, 8]} />
        <meshBasicMaterial
          color="#c7ffff"
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </instancedMesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.078, 3.622, 0.184]}
          scale={[0.055, 0.007, 0.012]}
        >
          <sphereGeometry args={[1, 10, 6]} />
          <meshBasicMaterial color="#c7ffff" transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function Platform({ animate, color }) {
  const rings = useRef(),
    halo = useRef();
  const ticks = useMemo(() => {
    const positions = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2,
        r = i % 4 === 0 ? 1.25 : 1.29;
      positions.push(
        Math.cos(a) * r,
        0.023,
        Math.sin(a) * r,
        Math.cos(a) * 1.34,
        0.023,
        Math.sin(a) * 1.34,
      );
    }
    return new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
  }, []);
  useEffect(() => () => ticks.dispose(), [ticks]);
  useFrame((_, delta) => {
    if (animate) {
      rings.current.rotation.y += Math.min(delta, 0.05) * 0.075;
      halo.current.rotation.y -= Math.min(delta, 0.05) * 0.05;
    }
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
        <circleGeometry args={[1.32, 96]} />
        <meshBasicMaterial color="#083c59" transparent opacity={0.25} />
      </mesh>
      <group ref={rings}>
        {[0.67, 1.02, 1.22, 1.4].map((radius, i) => (
          <mesh
            key={radius}
            rotation={[-Math.PI / 2, 0, i * 0.8]}
            position={[0, 0.01 + i * 0.008, 0]}
          >
            <torusGeometry
              args={[
                radius,
                i === 1 ? 0.012 : 0.005,
                6,
                96,
                i === 1 ? Math.PI * 1.63 : Math.PI * 2,
              ]}
            />
            <meshBasicMaterial
              color={i === 3 ? "#346591" : color}
              transparent
              opacity={i === 1 ? 0.85 : 0.35}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
        <lineSegments geometry={ticks}>
          <lineBasicMaterial color="#63dfff" transparent opacity={0.55} />
        </lineSegments>
      </group>
      <group ref={halo}>
        <mesh
          rotation={[Math.PI / 2 + 0.18, -0.25, 0.4]}
          position={[0, 2.05, -0.14]}
        >
          <torusGeometry args={[1.27, 0.003, 4, 128, Math.PI * 1.4]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.25}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      <gridHelper
        args={[9, 36, "#12314a", "#0b2238"]}
        position={[0, -0.05, 0]}
      />
    </group>
  );
}

function Atmosphere({ animate }) {
  const group = useRef();
  const positions = useMemo(() => {
    let seed = 71;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return new Float32Array(
      Array.from({ length: 180 }, () => [
        (random() - 0.5) * 5,
        random() * 4.9,
        (random() - 0.5) * 4,
      ]).flat(),
    );
  }, []);
  useFrame((_, delta) => {
    if (animate) group.current.rotation.y += Math.min(delta, 0.05) * 0.022;
  });
  return (
    <points ref={group}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#41b9e0"
        size={0.012}
        transparent
        opacity={0.48}
        depthWrite={false}
      />
    </points>
  );
}

function CameraRig({ command, animate }) {
  const controls = useRef();
  const { camera, invalidate } = useThree();
  useEffect(() => {
    if (!controls.current || !command) return;
    const target = controls.current.target;
    const offset = camera.position.clone().sub(target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    switch (command.action) {
      case "left":
        spherical.theta -= 0.25;
        break;
      case "right":
        spherical.theta += 0.25;
        break;
      case "up":
        spherical.phi = Math.max(0.8, spherical.phi - 0.12);
        break;
      case "down":
        spherical.phi = Math.min(1.8, spherical.phi + 0.12);
        break;
      case "in":
        spherical.radius = Math.max(5.6, spherical.radius - 0.6);
        break;
      case "out":
        spherical.radius = Math.min(11, spherical.radius + 0.6);
        break;
      default:
        camera.position.set(0, 2.55, 8.3);
        controls.current.target.set(0, 1.98, 0);
        controls.current.update();
        invalidate();
        return;
    }
    camera.position
      .copy(target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    controls.current.update();
    invalidate();
  }, [command, camera, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 1.98, 0]}
      enablePan={false}
      minDistance={5.6}
      maxDistance={11}
      minPolarAngle={0.8}
      maxPolarAngle={1.8}
      enableDamping={animate}
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.65}
    />
  );
}

export default function HologramScene({
  animate,
  command,
  accent = "#49dfff",
  onReady,
  onLost,
}) {
  const [dpr, setDpr] = useState(1.5);
  const cleanup = useRef(null);
  useEffect(() => () => cleanup.current?.(), []);
  return (
    <Canvas
      camera={{ position: [0, 2.55, 8.3], fov: 34, near: 0.1, far: 40 }}
      dpr={dpr}
      frameloop={animate ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        const lost = (event) => {
          event.preventDefault();
          onLost();
        };
        gl.domElement.addEventListener("webglcontextlost", lost);
        cleanup.current = () =>
          gl.domElement.removeEventListener("webglcontextlost", lost);
        onReady();
      }}
    >
      <fog attach="fog" args={["#07111f", 9, 17]} />
      <Human animate={animate} color={accent} />
      <Platform animate={animate} color={accent} />
      <Atmosphere animate={animate} />
      <CameraRig command={command} animate={animate} />
      {animate && (
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          flipflops={1}
          onFallback={() => setDpr(1)}
        />
      )}
    </Canvas>
  );
}
