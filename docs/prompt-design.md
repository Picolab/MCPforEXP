# Prompt Design Decisions for `manifold_v0.2.0`

This document explains why `prompts/manifold_v0.2.0.md` is written the way it is. The prompt is not just instruction text, it is a control surface for live conversational behavior in a demo environment.

## Why responses are kept to 1-3 sentences

The capstone demo runs in front of judges on a shared monitor, where reading speed and attention are constrained. Short responses reduce cognitive load and let the operator keep momentum while tool results update on screen.

Long responses looked smart in isolation but hurt the live flow by forcing presenters to scroll, summarize verbally, or interrupt the model. Constraining output length produced better demo usability and clearer value communication.

## Why skill gating is enforced in the prompt

Skill checks are partly a domain truth ("some actions require installed skills") and partly a conversational obligation ("ask before installing"). The prompt encodes this interaction policy so the assistant explains missing prerequisites in plain language and asks permission before changing system capabilities.

Code-level validation still matters for safety and correctness, but code alone cannot guarantee a coherent user experience. Prompt-level gating ensures each turn includes the right explanation, consent step, and continuation behavior even when the model is choosing among multiple tools.

## The "last used thing" context pattern

The interface is intentionally conversational, so users naturally say "tag it," "rename that," or "delete the new one." The prompt tells the model to track recent referents so those utterances resolve without repetitive clarification.

This pattern improves fluency while keeping actions grounded in prior tool outputs. It balances speed and safety: leverage remembered context by default, but still ask when ambiguity is real.

## Why destructive actions require confirmation

Delete operations are irreversible in the demo context and highly visible when wrong. The prompt requires explicit confirmation to prevent accidental state changes from ambiguous phrasing, speech-to-text mistakes, or audience-driven interruptions.

This is a trust pattern as much as a safety pattern. The assistant demonstrates that it can act powerfully, but only after checking intent.

## What changed from earlier versions

Earlier prompt iterations exposed several failure modes:

- Responses were too long and read like documentation, slowing down live presentation pacing.
- The model sometimes attempted skill-dependent actions without checking installed skills first.
- Destructive actions were not consistently preceded by an explicit confirmation turn.
- Output formatting drifted into heavy markdown, which looked out of place in a minimal chat UI.

`v0.2.0` tightened these areas by adding explicit length constraints, structured skill-gating instructions, stronger confirmation requirements for destructive actions, and display-oriented formatting guardrails.

## How to use this doc

Treat this document as rationale and `prompts/manifold_v0.2.0.md` as executable policy. If behavior regresses, update both: first the prompt instruction that changes behavior, then this document to capture why that trade-off was chosen.
