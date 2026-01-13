import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { API_BASE_URL } from "./config";

export default function App() {
  const [email, setEmail] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const updateAssistantMessage = useCallback((id: string, nextContent: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id ? { ...message, content: nextContent } : message
      )
    );
  }, []);

  const handleAsk = async () => {
    const trimmedEmail = email.trim();
    const trimmedPrompt = prompt.trim();

    if (!trimmedEmail || !trimmedPrompt) {
      setError("Both email and prompt are required.");
      return;
    }

    setLoading(true);
    setError("");
    setPrompt("");

    const now = Date.now();
    const userMessage: ChatMessage = {
      id: `user-${now}`,
      role: "user",
      content: trimmedPrompt
    };
    const assistantId = `assistant-${now + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: ""
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    const requestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail, prompt: trimmedPrompt })
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/ask/stream`, requestInit);

      if (!response.ok) {
        throw new Error("Request failed");
      }

      if (!response.body) {
        throw new Error("Missing response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: !doneReading });
          updateAssistantMessage(assistantId, buffer);
        }
      }
    } catch (err) {
      try {
        const fallback = await fetch(`${API_BASE_URL}/api/ask`, requestInit);

        if (!fallback.ok) {
          throw new Error("Fallback request failed");
        }

        const payload = (await fallback.json()) as { answer?: string };
        updateAssistantMessage(assistantId, payload.answer ?? "");
      } catch (fallbackError) {
        setError("Unable to reach the API. Ensure both services are running.");
        updateAssistantMessage(
          assistantId,
          "Sorry, I couldn't reach the assistant. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Assistant</Text>
            <Text style={styles.subtitle}>Ask anything. Your chat stays here.</Text>
          </View>
          <View style={styles.emailWrap}>
            <TextInput
              style={styles.emailInput}
              placeholder="you@example.com"
              placeholderTextColor="#a5a5a5"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatList}
          ItemSeparatorComponent={() => <View style={styles.messageSpacer} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageRow,
                item.role === "user" ? styles.userRow : styles.assistantRow
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  item.role === "user" ? styles.userBubble : styles.assistantBubble
                ]}
              >
                {item.content ? (
                  <Text
                    style={[
                      styles.bubbleText,
                      item.role === "user" ? styles.userText : styles.assistantText
                    ]}
                  >
                    {item.content}
                  </Text>
                ) : (
                  <View style={styles.typingRow}>
                    <ActivityIndicator size="small" color="#8a8a8a" />
                    <Text style={styles.typingText}>Thinking...</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.composer}>
          <TextInput
            style={styles.promptInput}
            placeholder="Message the assistant..."
            placeholderTextColor="#909090"
            multiline
            value={prompt}
            onChangeText={setPrompt}
            editable={!loading}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              (loading || !prompt.trim()) && styles.sendButtonDisabled,
              pressed && !loading && styles.sendButtonPressed
            ]}
            onPress={handleAsk}
            disabled={loading || !prompt.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendLabel}>Send</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0f121a"
  },
  flex: {
    flex: 1
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)"
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f7f7f7"
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#b4b7bd"
  },
  emailWrap: {
    marginTop: 14
  },
  emailInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#f3f3f3"
  },
  chatList: {
    paddingHorizontal: 16,
    paddingVertical: 20
  },
  messageSpacer: {
    height: 12
  },
  messageRow: {
    flexDirection: "row"
  },
  userRow: {
    justifyContent: "flex-end"
  },
  assistantRow: {
    justifyContent: "flex-start"
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  userBubble: {
    backgroundColor: "#3c6df0",
    borderTopRightRadius: 6
  },
  assistantBubble: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderTopLeftRadius: 6
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22
  },
  userText: {
    color: "#ffffff"
  },
  assistantText: {
    color: "#e7e7e7"
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  typingText: {
    marginLeft: 8,
    color: "#9da2a8",
    fontSize: 14
  },
  error: {
    color: "#ffb4b4",
    fontWeight: "600",
    textAlign: "center",
    paddingBottom: 8
  },
  composer: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)"
  },
  promptInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#f3f3f3"
  },
  sendButton: {
    backgroundColor: "#3c6df0",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    marginLeft: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  sendButtonPressed: {
    opacity: 0.9
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(60,109,240,0.5)"
  },
  sendLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
