import * as React from "react";
import MuiButton from "@mui/material/Button";

function mapVariant(variant) {
  if (variant === "outline") return "outlined";
  if (variant === "ghost") return "text";
  return "contained";
}

function mapSize(size) {
  if (size === "sm") return "small";
  if (size === "lg") return "large";
  return "medium";
}

function Button({ variant, size, asChild, ...props }) {
  if (asChild) {
    throw new Error("Button `asChild` is not supported in Material UI mode.");
  }

  return (
    <MuiButton
      variant={mapVariant(variant)}
      size={mapSize(size)}
      {...props}
    />
  );
}

export { Button };
