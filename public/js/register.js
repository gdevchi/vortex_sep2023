const form = document.querySelector("form");

async function registerUser(data) {
  const rawRes = await fetch("/api/v1/auth/account:update", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const response = await rawRes.json();
  if (response.status !== "success") throw response;
}

form.addEventListener("submit", async function (event) {
  try {
    event.preventDefault();
    await registerUser({
      firstName: event.target.elements.firstName.value,
      lastName: event.target.elements.lastName.value,
    });
    window.location.href = "/conferences";
  } catch (err) {
    alert(err.message);
  }
});
