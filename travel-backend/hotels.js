import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { city, checkInDate, checkOutDate } = req.query;

  if (!city || !checkInDate || !checkOutDate) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    // Get Amadeus API Token
    const tokenResponse = await axios.post(
      "https://test.api.amadeus.com/v1/security/oauth2/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: yOVBfR4hTCCm5WzMWy2ILcx3qyggrpci,
        client_secret: OdMUmWMYdhGwpAod,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;

    // Fetch Hotels from Amadeus API
    const response = await axios.get(
      `https://test.api.amadeus.com/v3/shopping/hotel-offers`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { cityCode: city, checkInDate, checkOutDate, adults: 1, roomQuantity: 1, currency: "USD" },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching hotels:", error);
    res.status(500).json({ message: "Error fetching hotels" });
  }
}
