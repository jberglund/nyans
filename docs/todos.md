# Explain/label each section

A user were confused about what the values actually mean (primarily the Chroma).

---

# Let the user define the amount of steps

Right now it's 20, from 0 to 950 with 50 increments.

In essence, those names are arbitrary. It could be step-1, step-2, increment up to step-X.

A few changes I know this will trigger:

- We have to be able to name the steps indidivually.
- We need an interface for it: amount of steps, name of steps

Point is, we'll need to allow naming the steps individually, but the amount of steps

---

# Lessen the need for knowledge about the inner workings of OKLCH

We'll want to users to be able to efficiently use this tool without the nitty gritty details of OKLCH.
