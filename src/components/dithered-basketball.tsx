import { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer } from "@react-three/postprocessing";
import { Effect, BlendFunction } from "postprocessing";

// Custom dithering effect
const ditheringFragmentShader = `
	uniform vec3 colorFront;
	uniform float pixelSize;

	// 4x4 Bayer matrix for ordered dithering
	float bayer4x4(vec2 pos) {
		int x = int(mod(pos.x, 4.0));
		int y = int(mod(pos.y, 4.0));
		int index = x + y * 4;

		float matrix[16];
		matrix[0] = 0.0/16.0;  matrix[1] = 8.0/16.0;  matrix[2] = 2.0/16.0;  matrix[3] = 10.0/16.0;
		matrix[4] = 12.0/16.0; matrix[5] = 4.0/16.0;  matrix[6] = 14.0/16.0; matrix[7] = 6.0/16.0;
		matrix[8] = 3.0/16.0;  matrix[9] = 11.0/16.0; matrix[10] = 1.0/16.0; matrix[11] = 9.0/16.0;
		matrix[12] = 15.0/16.0; matrix[13] = 7.0/16.0; matrix[14] = 13.0/16.0; matrix[15] = 5.0/16.0;

		return matrix[index];
	}

	void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
		vec2 pixelPos = floor(uv * resolution / pixelSize);

		float luma = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));
		float threshold = bayer4x4(pixelPos);

		if (inputColor.a < 0.1) {
			outputColor = vec4(0.0, 0.0, 0.0, 0.0);
		} else if (luma > threshold) {
			outputColor = vec4(colorFront, inputColor.a * 0.9);
		} else {
			outputColor = vec4(0.0, 0.0, 0.0, 0.0);
		}
	}
`;

class DitheringEffect extends Effect {
	constructor({ colorFront = "#f97316", pixelSize = 3 } = {}) {
		const uniforms = new Map<string, THREE.Uniform<THREE.Color | number>>();
		uniforms.set("colorFront", new THREE.Uniform(new THREE.Color(colorFront)));
		uniforms.set("pixelSize", new THREE.Uniform(pixelSize));

		super("DitheringEffect", ditheringFragmentShader, {
			blendFunction: BlendFunction.NORMAL,
			uniforms,
		});
	}
}

// Basketball with texture
function Basketball() {
	const meshRef = useRef<THREE.Mesh>(null);

	// Load basketball texture (CC-BY 3.0 from OpenGameArt)
	const texture = useTexture("/basketball-texture.png");

	useFrame((state) => {
		if (meshRef.current) {
			// Tilted rotation - angled like a spinning basketball
			meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
			meshRef.current.rotation.x = 0.4; // Fixed tilt angle
			meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.15) * 0.1;
		}
	});

	return (
		<mesh ref={meshRef}>
			<sphereGeometry args={[1.5, 64, 64]} />
			<meshStandardMaterial map={texture} roughness={0.8} />
		</mesh>
	);
}

function Effects() {
	const effect = useMemo(() => new DitheringEffect({ colorFront: "#f97316", pixelSize: 3 }), []);

	return (
		<EffectComposer>
			<primitive object={effect} />
		</EffectComposer>
	);
}

interface DitheredBasketballProps {
	className?: string;
	style?: React.CSSProperties;
}

export function DitheredBasketball({ className, style }: DitheredBasketballProps) {
	return (
		<div className={className} style={style}>
			<Canvas
				camera={{ position: [0, 0, 4], fov: 50 }}
				gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
				style={{ background: "transparent" }}
			>
				<ambientLight intensity={0.9} />
				<directionalLight position={[5, 5, 5]} intensity={0.8} />
				<Suspense fallback={null}>
					<Basketball />
					<Effects />
				</Suspense>
			</Canvas>
		</div>
	);
}
