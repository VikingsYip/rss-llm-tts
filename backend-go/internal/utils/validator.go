package utils

import (
	"fmt"
	"reflect"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// FieldValidator 数据库字段校验工具
type FieldValidator struct {
	// NonZeroFields 需要校验非零值的字段映射
	// key: 结构体字段名, value: 中文描述（用于错误日志）
	NonZeroFields map[string]string
}

// NewFieldValidator 创建字段校验器
func NewFieldValidator(fields map[string]string) *FieldValidator {
	return &FieldValidator{NonZeroFields: fields}
}

// ValidateNonZero 校验非零字段
// 返回 error 时表示有字段未通过校验
func (v *FieldValidator) ValidateNonZero(model interface{}) error {
	val := reflect.ValueOf(model)
	if val.Kind() != reflect.Ptr {
		return fmt.Errorf("model 必须是指针类型")
	}

	val = val.Elem()
	if val.Kind() != reflect.Struct {
		return fmt.Errorf("model 必须是结构体")
	}

	for fieldName, desc := range v.NonZeroFields {
		field := val.FieldByName(fieldName)
		if !field.IsValid() {
			log.Warn().Str("field", fieldName).Msg("模型中不存在该字段")
			continue
		}

		// 检查是否为零值
		if isZero(field) {
			return fmt.Errorf("%s 字段未赋值", desc)
		}
	}

	return nil
}

// isZero 判断反射值是否为零值
func isZero(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return v.Uint() == 0
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int() == 0
	case reflect.Float32, reflect.Float64:
		return v.Float() == 0
	case reflect.String:
		return v.String() == ""
	case reflect.Ptr, reflect.Interface:
		return v.IsNil()
	case reflect.Slice, reflect.Map, reflect.Array:
		return v.Len() == 0
	}
	return false
}

// ValidateAndLog 校验并记录日志
func (v *FieldValidator) ValidateAndLog(model interface{}, operation string) bool {
	if err := v.ValidateNonZero(model); err != nil {
		log.Error().Err(err).Str("operation", operation).Msg("字段校验失败")
		return false
	}
	return true
}

// PreSaveHook GORM 回调：插入前自动校验
// 用法：db.Callback().Create().Before("gorm:save_before_associations").Register("utils:validate_fields", utils.ValidateFieldsHook(&utils.FieldValidator{
//     NonZeroFields: map[string]string{
//         "RssFeedID": "rss_feed_id",
//         "Title":     "title",
//     },
// }))
func PreSaveHook(db *gorm.DB) {
	if db.Statement.Schema == nil {
		return
	}

	// 可以在这里添加全局校验逻辑
	// 例如：检查必填字段是否为空
}

// CommonNonZeroFields 通用必填字段映射
var CommonNonZeroFields = map[string]string{
	"Title":      "标题",
	"Link":       "链接",
	"RssFeedID":  "RSS源ID",
	"Name":       "名称",
	"URL":        "URL地址",
	"Content":    "内容",
}
