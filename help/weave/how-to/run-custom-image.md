---
title: "Run a step with a custom image"
summary: "Override a step's container image per service instance or per trigger, and change or roll it back later."
tags:
  - weave
  - image-override
  - service-instance
  - trigger
routes:
  - /pipelines/services/create
  - /pipelines/weave/triggers/create
---

## When to use this

One chain and blueprint can serve many customers or variants, each with its own
container image — without creating a blueprint per image.

## Rules

- The image needs an explicit tag (not `latest`) or a digest (`@sha256:…`).
- It must start with one of the cluster's allowed prefixes (shown above the
  editor). If none are configured, image overrides are disabled.

## On a service instance

1. **Pipelines → Services → Launch Service**, pick chain and deploy step.
2. Choose **Container image only** (no artifact lookup) or stay on
   *Index artifact* and fill the optional **Container Image** field.
3. Add overrides for other steps of the chain if needed.

On the instance's detail page use **Change image** (rolling update) and
**Roll back** (returns to the previous image). If the operator rejects the new
image, the old one keeps serving and the reason appears on the deployment card.

## On a trigger

In the trigger wizard's last step, **Image overrides** applies to every run the
trigger creates. Only Job steps can be overridden from a trigger; Kafka and
BatchCron triggers don't support it.
