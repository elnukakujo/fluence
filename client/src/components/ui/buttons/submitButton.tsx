import { Ring } from "ldrs/react";
import "ldrs/react/Ring.css";
import { useTranslations } from "next-intl";

type SubmitButtonProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
};

export default function SubmitButton({ children, isLoading }: SubmitButtonProps) {
  const t = useTranslations("ui");

  return (
    <button type="submit" className="btn btn-primary" disabled={isLoading}>
      {isLoading ? <Ring size={16} color="#fff" /> : children || t("save")}
    </button>
  );
}
