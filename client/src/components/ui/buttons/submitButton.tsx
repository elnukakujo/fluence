import { useTranslations } from "next-intl";
import Spinner from "@/components/ui/spinner";

type SubmitButtonProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
};

export default function SubmitButton({ children, isLoading }: SubmitButtonProps) {
  const t = useTranslations("ui");

  return (
    <button type="submit" className="btn btn-primary" disabled={isLoading}>
      {isLoading ? <Spinner /> : children || t("save")}
    </button>
  );
}
