import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Send } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface Props {
  phone: string;
  onSendSuccess: () => void;
  reservation?: any;
  trigger?: React.ReactNode;
}

const TEMPLATES = [
  {
    id: "brunch_di_gala_reservation_confirmation",
    name: "Brunch di Gala Confirmation",
    params: [
      "Name",
      "Date",
      "Day",
      "Batch",
      "Time",
      "Guests",
      "Contact",
      "Preparation",
    ],
  },
];

export function WhatsAppTemplateSelector({
  phone,
  onSendSuccess,
  reservation,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);

    // Auto-fill logic
    if (
      templateId === "brunch_di_gala_reservation_confirmation" &&
      reservation
    ) {
      // 0: Name {{1}}
      // 1: Date {{2}}
      // 2: Day {{3}}
      // 3: Batch {{4}}
      // 4: Time {{5}}
      // 5: Guests {{6}}
      // 6: Contact {{7}}
      // 7: Food Preparation {{8}}

      // Format Date stats
      // Assume reservation.date is YYYY-MM-DD or standard
      const dateObj = new Date(reservation.date);
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayName = days[dateObj.getDay()];
      const dayStr = dateObj.getDate().toString().padStart(2, "0");
      const monthStr = (dateObj.getMonth() + 1).toString().padStart(2, "0");
      const yearStr = dateObj.getFullYear();
      const formattedDate = `${dayStr}/${monthStr}/${yearStr}`;

      const params: Record<string, string> = {
        0: reservation.customerName,
        1: formattedDate,
        2: dayName,
        3: `${reservation.slot.startTime} - ${reservation.slot.endTime}`,
        4: reservation.slot.startTime,
        5: (reservation.adults + reservation.kids).toString(),
        6: reservation.contact,
        7: reservation.foodPref || "Not Specified",
      };
      setParamValues(params);
    } else {
      setParamValues({});
    }
  };

  const handleParamChange = (index: number, value: string) => {
    setParamValues((prev) => ({ ...prev, [index]: value }));
  };

  const handleSend = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    try {
      const template = TEMPLATES.find((t) => t.id === selectedTemplate);
      if (!template) return;

      // Construct params array in order
      const params = template.params.map(
        (_, index) => paramValues[index] || ""
      );

      // Ensure phone starts with 91
      let formattedPhone = phone.replace(/\D/g, ""); // Remove non-digits
      if (!formattedPhone.startsWith("91")) {
        formattedPhone = `91${formattedPhone}`;
      }

      await api.post("/chat/template", {
        phone: formattedPhone,
        templateId: selectedTemplate,
        params,
      });

      toast.success("Template sent successfully");
      setOpen(false);
      onSendSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Failed to send template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-white/10"
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-panel text-white border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Template</DialogTitle>
        </DialogHeader>

        {!selectedTemplate ? (
          <div className="space-y-2 mt-4">
            {TEMPLATES.map((template) => (
              <Button
                key={template.id}
                variant="outline"
                className="w-full justify-start text-left border-white/20 hover:bg-white/10"
                onClick={() => handleTemplateSelect(template.id)}
              >
                {template.name}
              </Button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {TEMPLATES.find((t) => t.id === selectedTemplate)?.name}
              </h3>
              <Button
                variant="link"
                size="sm"
                onClick={() => setSelectedTemplate(null)}
                className="text-blue-400 h-auto p-0"
              >
                Change
              </Button>
            </div>

            <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {TEMPLATES.find((t) => t.id === selectedTemplate)?.params.map(
                (param, index) => (
                  <div key={index} className="grid gap-1">
                    <Label
                      htmlFor={`param-${index}`}
                      className="text-xs text-gray-400"
                    >
                      {{
                        1: "Name",
                        2: "Date",
                        3: "Day",
                        4: "Batch",
                        5: "Time",
                        6: "Guests",
                        7: "Contact",
                        8: "Preparation",
                      }[index + 1] || param}
                      {/* Fallback to param name if not mapped, though I used param name above */}
                      {/* Wait, the TEMPLATES definition used Name, Date, etc as strings. Let's just use param. */}
                    </Label>
                    <Input
                      id={`param-${index}`}
                      placeholder={`Enter ${param}`}
                      className="glass-input h-8 text-sm"
                      value={paramValues[index] || ""}
                      onChange={(e) => handleParamChange(index, e.target.value)}
                    />
                  </div>
                )
              )}
            </div>

            <Button
              onClick={handleSend}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Sending..." : "Send Template"}
              <Send className="w-3 h-3 ml-2" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
