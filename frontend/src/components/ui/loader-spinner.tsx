import React from "react";

interface LoaderProps {
  className?: string;
}

export const LoaderSpinner: React.FC<LoaderProps> = ({ className = "" }) => {
  return <div className={`loader ${className}`} />;
};
