import { Platform } from "react-native";

const host = Platform.OS === "android" ? "10.0.2.2" : "localhost";

export const API_BASE_URL = `http://${host}:3001`;
