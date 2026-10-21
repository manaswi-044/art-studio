(() => {
  const canvas = document.querySelector("#cinematic-bg");
  if (!canvas) return;

  if (!window.THREE) {
    console.warn("Three.js did not load. Cinematic background disabled.");
    return;
  }

  const THREE = window.THREE;
  const isPottery = document.body.dataset.cinematic === "pottery";
  let renderer;
  let scene;
  let camera;
  let subject;
  let particles;
  let animationId;
  let resizeHandler;
  let pointerHandler;
  let visibilityHandler;
  let disposed = false;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 8);
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));

    const keyLight = new THREE.DirectionalLight(
      isPottery ? 0xffb36b : 0x77d9d4,
      3
    );
    keyLight.position.set(-3, 5, 6);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(
      isPottery ? 0xc65d37 : 0x8b78e6,
      16,
      20
    );
    fillLight.position.set(3, -1, 4);
    scene.add(fillLight);

    subject = new THREE.Group();
    scene.add(subject);

    if (isPottery) {
      const points = [
        new THREE.Vector2(0.05, -1.8),
        new THREE.Vector2(0.45, -1.75),
        new THREE.Vector2(0.72, -1.45),
        new THREE.Vector2(0.88, -0.9),
        new THREE.Vector2(0.82, -0.35),
        new THREE.Vector2(0.55, 0.25),
        new THREE.Vector2(0.4, 0.7),
        new THREE.Vector2(0.42, 1.15),
        new THREE.Vector2(0.55, 1.35),
        new THREE.Vector2(0.53, 1.45)
      ];
      const vase = new THREE.Mesh(
        new THREE.LatheGeometry(points, 96),
        new THREE.MeshStandardMaterial({
          color: 0xb96843,
          roughness: 0.3,
          metalness: 0.08,
          emissive: 0x30100a,
          emissiveIntensity: 0.25
        })
      );
      subject.add(vase);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.53, 0.055, 12, 80),
        new THREE.MeshStandardMaterial({ color: 0xe0a078, roughness: 0.35 })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 1.42;
      subject.add(rim);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.78, 0.025, 8, 80),
        new THREE.MeshStandardMaterial({
          color: 0xf0bd88,
          roughness: 0.4,
          metalness: 0.15
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.5;
      subject.add(ring);
    } else {
      subject.add(new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 4.2, 0.25),
        new THREE.MeshStandardMaterial({
          color: 0x25444a,
          roughness: 0.8,
          metalness: 0.05
        })
      ));

      [0xd2a65d, 0x558f91, 0x8173b6, 0xb96843].forEach((color, index) => {
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.45 + (index % 2) * 0.25,
            0.8 + (index % 3) * 0.2,
            0.08
          ),
          new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
        );
        block.position.set(-0.9 + index * 0.55, -1.1 + (index % 2) * 1.15, 0.2);
        subject.add(block);
      });

      const motif = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.055, 16, 100),
        new THREE.MeshStandardMaterial({
          color: 0xe2bd78,
          roughness: 0.35,
          metalness: 0.2
        })
      );
      motif.position.set(0.2, 0.85, 0.25);
      subject.add(motif);
    }

    subject.position.set(1.35, 0, 0);
    subject.scale.setScalar(0.85);

    const particleCount = 350;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: isPottery ? 0xf0b17c : 0x86d9d4,
        size: 0.025,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
        depthWrite: false
      })
    );
    scene.add(particles);

    let pointerX = 0;
    let pointerY = 0;
    pointerHandler = (event) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 0.3;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 0.2;
    };

    resizeHandler = () => {
      if (disposed) return;
      const width = window.innerWidth;
      camera.aspect = width / window.innerHeight;
      camera.position.z = width < 700 ? 10 : 8;
      camera.updateProjectionMatrix();
      renderer.setSize(width, window.innerHeight, false);
      subject.position.x = width < 700 ? 0.65 : 1.35;
      subject.scale.setScalar(width < 700 ? 0.65 : 0.85);
    };

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const clock = new THREE.Clock();
    const renderFrame = () => renderer.render(scene, camera);
    const animate = () => {
      if (disposed) return;
      animationId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      subject.rotation.y += (pointerX - subject.rotation.y) * 0.025;
      subject.rotation.x += (-pointerY - subject.rotation.x) * 0.025;
      subject.position.y = Math.sin(time * 0.45) * 0.08;
      particles.rotation.y = time * 0.012;
      particles.rotation.x = Math.sin(time * 0.1) * 0.04;
      renderFrame();
    };

    window.addEventListener("pointermove", pointerHandler, { passive: true });
    window.addEventListener("resize", resizeHandler);
    resizeHandler();

    if (motionQuery.matches) {
      renderFrame();
    } else {
      animate();
    }

    visibilityHandler = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationId);
      } else if (!motionQuery.matches) {
        animate();
      } else {
        renderFrame();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    window.addEventListener("pagehide", () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resizeHandler);
      window.removeEventListener("pointermove", pointerHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    }, { once: true });
  } catch (error) {
    console.error("Cinematic background could not start:", error);
    if (renderer) renderer.dispose();
    canvas.style.display = "none";
  }
})();
