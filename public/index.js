let sub = document.getElementById('sub');
sub.addEventListener('click',()=>{
  
  alert("thanks for feedback")
})

const cursor = document.querySelector(".cursor");
    const cursor2 = document.querySelector(".cursor2");
    document.addEventListener("mousemove", (e) => {
      if (cursor) {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
        cursor2.style.left = e.clientX + "px";
        cursor2.style.top = e.clientY + "px";
      }
    });

    // Toggle menu active class
    
    const checkbox = document.getElementById("checkbox");
    const menu = document.querySelector(".a");
    const cursor2Active = document.querySelector(".cursor2");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        menu.classList.add("active");
        cursor2Active.classList.remove("active");
      } else {
        menu.classList.remove("active");
        cursor2Active.classList.add("active");
      }
    });



    /**************main GSAP ******************* */

    gsap.registerPlugin(ScrollTrigger);

    // About section animations
    gsap.to(".ishow", {
      scrollTrigger: {
        trigger: ".ishow",
        start: "top 120%",
        toggleActions: "restart none none none",
        marker : true
      },
      height: "200%",
      duration: 1.5,
      ease: "power2.inOut"
    });

    gsap.to(".iblocka", {
      scrollTrigger: {
        trigger: ".iblocka",
        start: "top 120%",
        toggleActions: "restart none none none"
      },
      height: "290%",
      duration: 2,
      ease: "power2.inOut"
    });

    // Second about section
    gsap.to(".ishow1", {
      scrollTrigger: {
        trigger: ".ishow1",
        start: "top 120%",
        toggleActions: "restart none none none"
      },
      height: "200%",
      duration: 1.5,
      ease: "power2.inOut"
    });

    gsap.to(".iblock1a", {
      scrollTrigger: {
        trigger: ".iblock1a",
        start: "top 120%",
        toggleActions: "restart none none none"
      },
      height: "290%",
      duration: 2,
      ease: "power2.inOut"
    });

    // Show paragraph animations
    gsap.to(".para", {
      scrollTrigger: {
        trigger: ".para",
        start: "top 100%",
        toggleActions: "restart none none none"
      },
      y: 0,
      duration: 1,
      ease: "power2.inOut"
    }); 


    gsap.from(".hterms", {
      scrollTrigger: {
        trigger: ".hterms",
        start: "top 120%",
        toggleActions: "restart none none none"
      },
      y: 150,
      opacity:0,
      duration: 1.3,
      ease: "power2.inOut"
    }); 
    

    gsap.from(".condition-item", {
      scrollTrigger: {
        trigger: ".condition-item",
        start: "top 120%",
        toggleActions: "restart none none none"
      },
      y: 150,
      duration: 1.3,
      ease: "power2.inOut"
    }); 

    gsap.from(".head", {
      scrollTrigger: {
        trigger: ".head",
        start: "top 90%",
        toggleActions: "restart none none none"
      },
      y: 150,
      opacity:0,
      duration: 1.5,
      ease: "power2.inOut"
    });

    gsap.from(".b_name", {
      scrollTrigger: {
        trigger: ".b_name",
        start: "top 90%",
        toggleActions: "restart none none none"
      },
      y: 150,
      opacity:0,
      duration: 1.5,
      ease: "power2.inOut"
    });
