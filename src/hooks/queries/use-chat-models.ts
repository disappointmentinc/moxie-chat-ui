import { appStore } from "@/app/store";
import { fetcher } from "lib/utils";
import useSWR from "swr";

export const useChatModels = () => {
  return useSWR<
    {
      provider: string;
      models: {
        name: string;
        isToolCallUnsupported: boolean;
      }[];
    }[]
  >("/api/chat/models", fetcher, {
    dedupingInterval: 60_000 * 5,
    revalidateOnFocus: false,
    fallbackData: [],
    onSuccess: (data) => {
      const status = appStore.getState();
      if (!status.chatModel) {
        // Prefer OpenAI gpt-5 as default when available
        const openai = data.find((p) => p.provider === "openai");
        const gpt5 = openai?.models.find((m) => m.name === "gpt-5");
        if (openai && gpt5) {
          appStore.setState({ chatModel: { provider: "openai", model: "gpt-5" } });
        } else if (data.length && data[0].models.length) {
          const firstProvider = data[0].provider;
          const model = data[0].models[0].name;
          appStore.setState({ chatModel: { provider: firstProvider, model } });
        }
      }
    },
  });
};
