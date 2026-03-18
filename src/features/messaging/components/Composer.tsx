//src/features/messaging/components/Composer.tsx

"use client";

import { FC, useState } from "react";

interface ComposerProps {
  disabled?: boolean;
}

const Composer: FC<ComposerProps> = ({ disabled = true }) => {
  const [value, setValue] = useState("");

  return (
    <footer className="border-t border-gray-200 bg-white p-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => e.preventDefault()}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          placeholder="Select a conversation to start messaging…"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-400 disabled:bg-gray-100"
        />

        <button
          type="submit"
          disabled
          className="rounded-lg bg-gray-300 px-4 py-2 text-sm text-white">
          Send
        </button>
      </form>
    </footer>
  );
};

export default Composer;
