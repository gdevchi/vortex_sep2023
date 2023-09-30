const messageEl = document.querySelector(".message");
try {
  const state = {
    progress: false,
  };

  const MMSDK = new MetaMaskSDK.MetaMaskSDK();
  MMSDK.init()
    .then(() => {
      const ethereum = MMSDK.getProvider();

      async function getUserNonce(address) {
        const rawRes = await fetch("/api/v1/auth/nonce", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            address,
          }),
        });
        const response = await rawRes.json();
        if (response.status !== "success") throw response;
        return response.data.nonce;
      }

      async function getAuthToken(crendentials) {
        const rawRes = await fetch("/api/v1/auth/authenticate", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(crendentials),
        });
        const response = await rawRes.json();
        if (response.status !== "authorized") throw response;
      }

      // Function to request user login using Metamask
      async function initiateLogin(ethereum) {
        try {
          state.progress = true;
          const accounts = await ethereum.request({
            method: "eth_requestAccounts",
          });

          messageEl.textContent =
            "Please open metamask app manually, if metamask sign window popup not visible in mobile";

          const address = accounts[0];
          const nonce = await getUserNonce(address);
          const message = `I am signing this message with nonce:${nonce}`;
          const signedMessage = await ethereum.request({
            method: "personal_sign",
            params: [message, address],
          });
          //get and save auth token in cookie
          await getAuthToken({ signedMessage, message, address });
          window.location.href = "/conferences";
        } catch (err) {
          state.progress = false;
          alert(err.message);
        }
      }

      async function getGuestAuthToken(crendentials) {
        const rawRes = await fetch("/api/v1/auth/authenticate:guest", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(crendentials),
        });
        const response = await rawRes.json();
        if (response.status !== "authorized") throw response;
      }

      // Handle the login button click
      document
        .querySelector(".metamask-button")
        .addEventListener("click", async () => {
          if (state.progress) return;
          try {
            if (!ethereum) {
              throw { message: "Metamask is not installed" };
            }
            await initiateLogin(ethereum);
          } catch (err) {
            state.progress = false;
            alert(err.message);
          }
        });

      //Handle guest form button click
      document
        .querySelector(".guest-form")
        .addEventListener("submit", async (event) => {
          event.preventDefault();
          if (state.progress) return;
          try {
            state.progress = true;
            await getGuestAuthToken({
              firstName: event.target.elements.username.value,
            });
            window.location.href = "/conferences";
          } catch (err) {
            state.progress = false;
            alert(err.message);
          }
        });
    })
    .catch((err) => console.log(err));
} catch (err) {
  messageEl.textContent = err.message;
}
