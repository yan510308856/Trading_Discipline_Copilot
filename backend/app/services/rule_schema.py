"""Schema validation for YAML price-action rule definitions."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


Stage = Literal["pre_trade", "in_trade", "post_trade"]
Severity = Literal["blocker", "warning", "reminder"]

SUPPORTED_OPERATORS = {
    "missing",
    "equals",
    "in",
    "greater_than",
    "greater_than_or_equal",
    "less_than",
    "less_than_or_equal",
    "greater_than_field",
    "less_than_field",
}


class RuleConditionModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str = Field(min_length=1)
    operator: str = Field(min_length=1)
    value: Any = None
    compare_field: Optional[str] = None

    @field_validator("operator")
    @classmethod
    def validate_operator(cls, value: str) -> str:
        if value not in SUPPORTED_OPERATORS:
            raise ValueError(f"Unsupported rule operator: {value}")
        return value

    @model_validator(mode="after")
    def validate_operator_shape(self) -> "RuleConditionModel":
        if self.operator == "in" and not isinstance(self.value, list):
            raise ValueError("Operator 'in' requires a list value")
        if self.operator in {"greater_than_field", "less_than_field"} and not self.compare_field:
            raise ValueError(f"Operator '{self.operator}' requires compare_field")
        return self


class RuleDefinitionModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    stage: Stage
    severity: Severity
    trigger: dict[str, Any]
    conditions: list[RuleConditionModel]
    message: str = Field(min_length=1)
    checklist: list[str]
    next_actions: list[str]
    ui_hints: dict[str, Any]
    requires_acknowledgement: bool
    avoid: str = Field(min_length=1)
    discipline_sentence: str = Field(min_length=1)
    enabled: bool


class RuleDocumentModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: int
    rules: list[RuleDefinitionModel]
