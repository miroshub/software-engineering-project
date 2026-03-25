function createSession() {
  var course = document.getElementById("course").value;
  var date = document.getElementById("sessiondate").value;
  if (!course || !date) {
    alert("Please select a course and date");
    return;
  }
  var msg = document.getElementById("successmessage");
  msg.style.display = "block";
  setTimeout(function () {
    msg.style.display = "none";
  }, 4000);
}

function generateReport() {
  document.getElementById("reportOutput").style.display = "block";
}

function filterTable() {
  var query = "";
  var searchEl = document.getElementById("searchInput");
  if (searchEl) query = searchEl.value.toLowerCase();
  var rows = document.querySelectorAll("#studentTable tr");
  rows.forEach(function (row) {
    if (row.textContent.toLowerCase().includes(query)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}
