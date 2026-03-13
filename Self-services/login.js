function showpassword() {
  let pass = document.getElementById("Pass");
  if (pass.type === "password") {
    pass.type = "text";
  } else {
    pass.type = "password";
  }
}
