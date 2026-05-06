namespace HotelMaximos.Api.Shared.Api;

public sealed record PaginatedResponse<T>(
    IReadOnlyList<T> Data,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);
