"use client";

import Image from "next/image";
import { useState } from "react";
import { buttonClass } from "@pegah/ui";
import { newsletterPhoto } from "@/data/home";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  return (
    <section
      className="relative mt-28 overflow-hidden px-[max(16px,env(safe-area-inset-left,0px))] text-white"
      aria-labelledby="nl-h"
    >
      <Image
        src={newsletterPhoto.src}
        alt=""
        fill
        sizes="100vw"
        placeholder="blur"
        className="object-cover"
      />
      <span className="absolute inset-0 bg-[linear-gradient(90deg,rgb(9_12_34/0.85),rgb(9_12_34/0.35)_70%,rgb(9_12_34/0.15))]" />
      <div className="relative z-[1] mx-auto grid max-w-[1280px] gap-4 py-28">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary">
          Season letters
        </p>
        <h2
          id="nl-h"
          className="max-w-[14ch] font-display text-[clamp(2rem,4.4vw,3.5rem)] font-medium leading-[1.04]"
        >
          First to know when the season opens.
        </h2>
        <p className="m-0 max-w-[44ch] text-white/85">
          One email at the start of each ritu: new departures, early prices, and where the light is
          best.
        </p>
        <form
          noValidate
          className="mt-2 flex max-w-[520px] flex-wrap gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(
              EMAIL.test(email.trim())
                ? `Prototype: the live site would subscribe ${email.trim()}.`
                : "Enter an email address like name@example.com.",
            );
          }}
        >
          <label htmlFor="nl-email" className="sr-only">
            Email address
          </label>
          <input
            id="nl-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 flex-[1_1_240px] rounded-control border-[1.5px] border-white/60 bg-night/35 px-4 py-3.5 text-white placeholder:text-white/65"
          />
          <button type="submit" className={buttonClass("primary", "md", "h-auto px-6 py-3.5")}>
            Subscribe
          </button>
        </form>
        <p role="status" aria-live="polite" className="min-h-6 text-[0.9rem]">
          {msg}
        </p>
      </div>
      <span className="absolute bottom-2.5 right-[max(16px,env(safe-area-inset-right,0px))] z-[1] text-[0.7rem] opacity-75">
        {newsletterPhoto.credit}
      </span>
    </section>
  );
}
