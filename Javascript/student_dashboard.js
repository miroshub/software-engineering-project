// Interactivity

document.addEventListener("DOMContentLoaded", function(){
    const progressBars = document.querySelectorAll(".progress-bar");
    const reportButton = document.querySelector(".report-btn");

    progressBars.forEach(function (bar){
        const finalWidth = bar.style.width;
        bar.style.width = "0%";

        setTimeout(function(){
            bar.style.width = finalWidth;
        }, 200);
    });
});

// Database

