namespace HotelMaximos.Api.Shared.Api;

public sealed record ApiErrorResponse(
    string ErrorNumber,
    string Message,
    string? Details,
    string TraceId,
    IReadOnlyDictionary<string, string[]>? Errors = null)
{
    public static ApiErrorResponse Unexpected(string traceId)
    {
        return new ApiErrorResponse(
            "UNEXPECTED_ERROR",
            "Ocorreu um erro inesperado.",
            "Tente novamente ou informe o suporte com o traceId retornado.",
            traceId);
    }
}
