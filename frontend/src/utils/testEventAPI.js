// Quick test to check if event API returns rounds
// Run this in browser console or use in testing

const testEventAPI = async (eventId) => {
  try {
    const token = localStorage.getItem("token"); // or however you store auth token

    const response = await fetch(
      `http://localhost:3000/api/v1/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();
    console.log("Full Response:", data);
    console.log("Event:", data.data?.event);
    console.log("Rounds:", data.data?.event?.rounds);
    console.log("Current Round:", data.data?.event?.currentRound);

    return data;
  } catch (error) {
    console.error("API Error:", error);
  }
};

// Usage:
// testEventAPI('YOUR_EVENT_ID_HERE');

export { testEventAPI };
